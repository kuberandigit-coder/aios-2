# Kamsi Req 1 — Shopify-only aggregation (2026-07-06 source migration)
# Input 1: 2026-07-06_kamsi_req1_shopify_catalog_inventory.jsonl (bulk op: products+variants+inventoryQuantity)
# Input 2: 2026-07-06_kamsi_req1_shopify_orders_90d.jsonl (bulk op: orders created_at>=2026-04-07 + line items)
# Output:  2026-07-06_kamsi_req1_shopify_orders_90d.csv (sku, units_sold_90d, last_order_date) — cancelled orders EXCLUDED
#          2026-07-06_kamsi_req1_shopify_stock_by_sku.csv (sku, stock) — Shopify available inventory (inventoryQuantity)
import json, csv, os
D = os.path.dirname(os.path.abspath(__file__))

# --- orders ---
orders_meta = {}   # order gid -> (createdAt date, cancelled?)
sku_units = {}
sku_last = {}
n_orders = n_cancelled = n_lines_nosku = 0
with open(os.path.join(D, "2026-07-06_kamsi_req1_shopify_orders_90d.jsonl"), encoding="utf-8") as f:
    for line in f:
        o = json.loads(line)
        if "__parentId" not in o:
            n_orders += 1
            cancelled = o.get("cancelledAt") is not None
            if cancelled: n_cancelled += 1
            orders_meta[o["id"]] = (o["createdAt"][:10], cancelled)
        else:
            date, cancelled = orders_meta[o["__parentId"]]
            if cancelled: continue
            sku = (o.get("sku") or "").strip()
            if not sku: n_lines_nosku += 1; continue
            sku_units[sku] = sku_units.get(sku, 0) + int(o.get("quantity") or 0)
            if date > sku_last.get(sku, ""): sku_last[sku] = date

with open(os.path.join(D, "2026-07-06_kamsi_req1_shopify_orders_90d.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["sku", "units_sold_90d", "last_order_date"])
    for sku in sorted(sku_units): w.writerow([sku, sku_units[sku], sku_last[sku]])

# --- stock (Shopify inventoryQuantity = available across all Shopify locations) ---
prod_status = {}
stock = {}   # sku -> qty, first ACTIVE-product occurrence wins (matches catalog dedupe rule)
with open(os.path.join(D, "2026-07-06_kamsi_req1_shopify_catalog_inventory.jsonl"), encoding="utf-8") as f:
    for line in f:
        o = json.loads(line)
        if "__parentId" not in o:
            prod_status[o["id"]] = o.get("status")
        else:
            sku = (o.get("sku") or "").strip()
            if not sku or sku in stock: continue
            if prod_status.get(o["__parentId"]) != "ACTIVE": continue
            stock[sku] = int(o.get("inventoryQuantity") or 0)

with open(os.path.join(D, "2026-07-06_kamsi_req1_shopify_stock_by_sku.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["sku", "stock"])
    for sku in sorted(stock): w.writerow([sku, stock[sku]])

print(f"orders={n_orders} cancelled_excluded={n_cancelled} lines_no_sku={n_lines_nosku} "
      f"skus_with_sales={len(sku_units)} skus_with_stock={len(stock)}")
