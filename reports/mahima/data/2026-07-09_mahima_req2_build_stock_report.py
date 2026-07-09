import json, re

SCRATCH = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\70f4c24d-cd7a-4f0b-8578-7ff0939371d2\scratchpad"

# 1. Parse bulk catalog JSONL -> products + variants
products = {}   # id -> {title, productType}
variants = []   # list of {sku, title, inventoryQuantity, parentId}
with open(f"{SCRATCH}\\ledsone_catalog_bulk.jsonl", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if "__parentId" in obj:
            variants.append(obj)
        else:
            products[obj["id"]] = {"title": obj.get("title") or "", "productType": obj.get("productType") or ""}

print("catalog products:", len(products))
print("catalog variants:", len(variants))

# 2. Parse ShopifyQL inventory report (stock + 30d sales), keyed by (product_title, variant_title)
with open(f"{SCRATCH}\\inventory_raw.json", encoding="utf-8") as f:
    inv = json.load(f)

col_idx = {c["name"]: i for i, c in enumerate(inv["columns"])}
inv_map = {}
dupe_keys = 0
for row in inv["rows"]:
    pt = row[col_idx["product_title"]]
    vt = row[col_idx["product_variant_title"]]
    key = (pt, vt)
    rec = {
        "starting": int(row[col_idx["starting_inventory_units"]]),
        "ending": int(row[col_idx["ending_inventory_units"]]),
        "sold": int(row[col_idx["inventory_units_sold"]]),
    }
    if key in inv_map:
        dupe_keys += 1
    inv_map[key] = rec

print("inventory rows:", len(inv["rows"]))
print("inventory unique keys:", len(inv_map), "dupe_keys_overwritten:", dupe_keys)

# 3. Join catalog variants to inventory by (product_title, variant_title)
rows = []
matched = 0
unmatched = 0
blank_sku = 0
blank_category = 0

for v in variants:
    parent = products.get(v["__parentId"], {"title": "", "productType": ""})
    title = parent["title"]
    ptype = parent["productType"]
    vtitle = v.get("title") or ""
    sku = v.get("sku") or ""
    if not sku:
        blank_sku += 1
    if not ptype:
        blank_category += 1

    key = (title, vtitle)
    invrec = inv_map.get(key)

    if invrec is not None:
        matched += 1
        current_stock = invrec["ending"]
        last_30d_sales = invrec["sold"]
        sales_source = "inventory_table"
    else:
        unmatched += 1
        current_stock = v.get("inventoryQuantity")
        last_30d_sales = None
        sales_source = "missing"

    rows.append({
        "sku": sku,
        "product_title": title,
        "variant_title": vtitle,
        "product_type": ptype,
        "current_stock": current_stock,
        "last_30d_sales": last_30d_sales,
        "sales_source": sales_source,
    })

print("matched (has real 30d sales+stock from inventory table):", matched)
print("unmatched (stock from catalog only, sales genuinely unknown):", unmatched)
print("blank sku:", blank_sku)
print("blank category (product_type):", blank_category)
print("total rows:", len(rows))

with open(f"{SCRATCH}\\joined_rows.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False)

print("wrote joined_rows.json")
