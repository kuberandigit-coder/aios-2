import json, os, collections, datetime

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

IN = p("2026-07-08_kamsi_req6_bulk_products.jsonl")

products = {}
variant_rows = []

with open(IN, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        parent = obj.get("__parentId")
        if parent is None:
            gid = obj["id"]
            products[gid] = {
                "title": obj["title"],
                "handle": obj["handle"],
                "status": obj.get("status") or "",
                "updatedAt": obj.get("updatedAt") or "",
            }
        else:
            # variant row (nested under product)
            if "sku" in obj or "price" in obj:
                variant_rows.append({
                    "product_gid": parent,
                    "variant_id": obj["id"],
                    "variant_title": obj.get("title") or "",
                    "sku": (obj.get("sku") or "").strip(),
                    "price": obj.get("price"),
                    "compare_at_price": obj.get("compareAtPrice"),
                })

print("products:", len(products), "variant rows:", len(variant_rows))

RUN_DATE = "2026-07-08"

rows = []
for v in variant_rows:
    prod = products.get(v["product_gid"])
    if prod is None:
        continue
    rows.append({
        "sku": v["sku"],
        "product_title": prod["title"],
        "variant_title": v["variant_title"],
        "listing_url": "/products/%s" % prod["handle"],
        "current_price": float(v["price"]) if v["price"] not in (None, "") else None,
        "compare_price": float(v["compare_at_price"]) if v["compare_at_price"] not in (None, "") else None,
        "product_status": prod["status"],
        "last_checked": RUN_DATE,
    })

print("total variant/listing rows:", len(rows))

blank_sku_rows = [r for r in rows if not r["sku"]]
non_blank_rows = [r for r in rows if r["sku"]]
print("blank SKU rows:", len(blank_sku_rows), "non-blank SKU rows:", len(non_blank_rows))

# ---- group by SKU (non-blank only) ----
by_sku = collections.defaultdict(list)
for r in non_blank_rows:
    by_sku[r["sku"]].append(r)

sku_meta = {}
for sku, group in by_sku.items():
    dup_count = len(group)
    is_dup = dup_count >= 2
    prices = set(r["current_price"] for r in group if r["current_price"] is not None)
    price_mismatch = is_dup and len(prices) > 1
    urls = sorted(set(r["listing_url"] for r in group))
    sku_meta[sku] = {
        "duplicate_count": dup_count,
        "duplicate": is_dup,
        "price_mismatch": price_mismatch,
        "matching_urls": urls,
    }

# ---- final row assembly ----
final_rows = []
for r in non_blank_rows:
    meta = sku_meta[r["sku"]]
    final_rows.append({
        **r,
        "duplicate": meta["duplicate"],
        "duplicate_count": meta["duplicate_count"],
        "price_mismatch": meta["price_mismatch"],
        "matching_urls": meta["matching_urls"],
    })
for r in blank_sku_rows:
    final_rows.append({
        **r,
        "duplicate": False,
        "duplicate_count": 1,
        "price_mismatch": False,
        "matching_urls": [r["listing_url"]],
    })

# ---- KPIs ----
total_variant_rows = len(rows)
unique_skus = len(by_sku)
duplicate_skus = sum(1 for m in sku_meta.values() if m["duplicate"])
rows_with_dup_sku = sum(1 for r in final_rows if r["duplicate"])
price_mismatch_skus = sum(1 for m in sku_meta.values() if m["price_mismatch"])
blank_sku_count = len(blank_sku_rows)

print("\n--- KPIs ---")
print("Total Variant Rows Checked:", total_variant_rows)
print("Unique SKUs Checked:", unique_skus)
print("Duplicate SKUs:", duplicate_skus)
print("Rows With Duplicate SKU:", rows_with_dup_sku)
print("Price Mismatch SKUs:", price_mismatch_skus)
print("Blank SKU Rows:", blank_sku_count)

# ---- edge-case validation samples ----
print("\n--- sample duplicate SKUs with price mismatch ---")
shown = 0
for sku, m in sku_meta.items():
    if m["price_mismatch"]:
        group = by_sku[sku]
        print(sku, "->", [(g["listing_url"], g["current_price"]) for g in group])
        shown += 1
        if shown >= 5:
            break

print("\n--- sample duplicate SKUs, same price (no mismatch) ---")
shown = 0
for sku, m in sku_meta.items():
    if m["duplicate"] and not m["price_mismatch"]:
        group = by_sku[sku]
        print(sku, "->", [(g["listing_url"], g["current_price"]) for g in group])
        shown += 1
        if shown >= 3:
            break

print("\n--- sample SKU on 3+ listings ---")
shown = 0
for sku, m in sku_meta.items():
    if m["duplicate_count"] >= 3:
        group = by_sku[sku]
        print(sku, "count:", m["duplicate_count"], "->", [(g["listing_url"], g["current_price"]) for g in group])
        shown += 1
        if shown >= 3:
            break

# ---- save outputs ----
OUT_JSON = p("2026-07-08_kamsi_req6_rows.json")
json.dump(final_rows, open(OUT_JSON, "w", encoding="utf-8"))
print("\nwrote:", OUT_JSON, "rows:", len(final_rows))

import csv
OUT_CSV = p("2026-07-08_kamsi_req6_duplicate_price_log.csv")
with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["sku", "product_title", "variant_title", "listing_url", "current_price", "compare_price",
                "duplicate", "duplicate_count", "price_mismatch", "matching_urls", "product_status", "last_checked"])
    for r in final_rows:
        w.writerow([r["sku"], r["product_title"], r["variant_title"], r["listing_url"],
                    r["current_price"], r["compare_price"], r["duplicate"], r["duplicate_count"],
                    r["price_mismatch"], " | ".join(r["matching_urls"]), r["product_status"], r["last_checked"]])
print("wrote:", OUT_CSV)
