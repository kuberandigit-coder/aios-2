# Sukirtha task: ledsone.de products with 0 or 1 sale in June 2026
# Inputs: products.jsonl, orders.jsonl (Shopify bulk exports)
import json, csv, os
from datetime import datetime, timedelta, timezone

SCRATCH = os.path.dirname(os.path.abspath(__file__))
OUT = r"C:\Users\PC\OneDrive\Desktop\kuberan web\evidence\sukirtha\shopify_sales_last_month"
CEST = timezone(timedelta(hours=2))
JUNE_START = datetime(2026, 6, 1, 0, 0, 0, tzinfo=CEST)
JUNE_END = datetime(2026, 6, 30, 23, 59, 59, 999999, tzinfo=CEST)

products, variants, sku_index = {}, {}, {}
with open(os.path.join(SCRATCH, "products.jsonl"), encoding="utf-8") as f:
    for line in f:
        rec = json.loads(line)
        rid = rec["id"]
        if "/Product/" in rid:
            products[rid] = {"id": rid, "title": rec["title"], "handle": rec["handle"],
                             "status": rec["status"], "url": rec.get("onlineStoreUrl"),
                             "image": (rec.get("featuredImage") or {}).get("url", ""),
                             "variants": []}
        elif "/ProductVariant/" in rid:
            pid = rec["__parentId"]
            products[pid]["variants"].append(rec)
            variants[rid] = pid
            if rec.get("sku"):
                sku_index.setdefault(rec["sku"], pid)

june_qty, last_order = {}, {}
orders_meta = {}
n_orders = n_june_orders = n_lines = n_june_lines = 0
match_counts = {"variant": 0, "product": 0, "sku": 0}
unmatched = []
with open(os.path.join(SCRATCH, "orders.jsonl"), encoding="utf-8") as f:
    for line in f:
        rec = json.loads(line)
        rid = rec.get("id", "")
        if "/Order/" in rid:
            n_orders += 1
            dt = datetime.fromisoformat(rec["createdAt"].replace("Z", "+00:00")).astimezone(CEST)
            cancelled = rec.get("cancelledAt") is not None
            in_june = JUNE_START <= dt <= JUNE_END
            if in_june and not cancelled:
                n_june_orders += 1
            orders_meta[rid] = (dt, cancelled, in_june)
        elif "quantity" in rec:
            n_lines += 1
            dt, cancelled, in_june = orders_meta[rec["__parentId"]]
            if cancelled:
                continue
            if in_june:
                n_june_lines += 1
            pid, mtype = None, None
            v = rec.get("variant")
            if v and v.get("id") in variants:
                pid, mtype = variants[v["id"]], "variant"
            elif rec.get("product") and (rec["product"] or {}).get("id") in products:
                pid, mtype = rec["product"]["id"], "product"
            elif rec.get("sku") and rec["sku"] in sku_index:
                pid, mtype = sku_index[rec["sku"]], "sku"
            if pid is None:
                unmatched.append({"order": rec["__parentId"], "sku": rec.get("sku"),
                                  "june": in_june, "qty": rec["quantity"]})
                continue
            match_counts[mtype] += 1
            if in_june:
                june_qty[pid] = june_qty.get(pid, 0) + rec["quantity"]
            if pid not in last_order or dt > last_order[pid]:
                last_order[pid] = dt

os.makedirs(OUT, exist_ok=True)
csv_path = os.path.join(OUT, "2026-06_ledsone_de_1-sale_no-sales_products.csv")
rows_written = {"NO SALES": 0, "1 SALE": 0}
excluded_gt1 = 0
with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["Product ID", "Product Title", "Product Handle", "Product Status",
                "Product URL", "Image URL", "Variant IDs", "SKUs", "Price (EUR)",
                "Stock Qty", "Qty Sold 2026-06", "Sales Status", "Last Order Date"])
    for pid in sorted(products, key=lambda p: products[p]["handle"]):
        p = products[pid]
        q = june_qty.get(pid, 0)
        if q > 1:
            excluded_gt1 += 1
            continue
        status = "1 SALE" if q == 1 else "NO SALES"
        rows_written[status] += 1
        vids = "; ".join(v["id"].split("/")[-1] for v in p["variants"])
        skus = "; ".join((v.get("sku") or "SKU MISSING") for v in p["variants"])
        prices = sorted({float(v["price"]) for v in p["variants"]})
        price = f"{prices[0]:.2f}" if len(prices) == 1 else f"{prices[0]:.2f}-{prices[-1]:.2f}"
        stock = sum(v.get("inventoryQuantity") or 0 for v in p["variants"])
        lo = last_order.get(pid)
        w.writerow([pid.split("/")[-1], p["title"], p["handle"], p["status"],
                    p["url"] or f"https://ledsone.de/products/{p['handle']}",
                    p["image"], vids, skus, price, stock, q, status,
                    lo.strftime("%Y-%m-%d") if lo else "NEVER (since 2023-01-01)"])

stats = {"products": len(products), "variants": len(variants),
         "orders_total_since_2023": n_orders, "orders_june_noncancelled": n_june_orders,
         "line_items_total": n_lines, "line_items_june": n_june_lines,
         "match_counts": match_counts, "unmatched_lines": len(unmatched),
         "unmatched_june_lines": sum(1 for u in unmatched if u["june"]),
         "no_sales": rows_written["NO SALES"], "one_sale": rows_written["1 SALE"],
         "excluded_qty_gt1": excluded_gt1, "csv": csv_path}
with open(os.path.join(SCRATCH, "stats.json"), "w") as f:
    json.dump(stats, f, indent=2)
with open(os.path.join(SCRATCH, "unmatched.json"), "w") as f:
    json.dump(unmatched[:200], f, indent=2)
print(json.dumps(stats, indent=2))
