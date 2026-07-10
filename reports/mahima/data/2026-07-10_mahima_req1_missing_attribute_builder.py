# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"

attrs = json.load(io.open(SP + r"\missing_attrs_raw.json", encoding="utf-8"))["data"]["rows"]
main = json.load(io.open(SP + r"\req1_new_rows.json", encoding="utf-8"))

ATTR_LABELS = {
    "m_category": "product_category",
    "m_item_group": "item_group_id",
    "m_mpn": "mpn",
    "m_color": "color",
    "m_condition": "condition",
    "m_description": "description",
    "m_product_types": "product_types",
    "m_availability": "availability",
    "m_brand": "brand",
    "m_price": "price",
}

lookup = {}
for r in attrs:
    missing = [label for key, label in ATTR_LABELS.items() if r[key] is True or r[key] == "t" or r[key] == True]
    lookup[r["idnum"]] = ", ".join(missing) if missing else "None missing"

matched = 0
for row in main["rows"]:
    item_id = row["item_id"]
    if item_id in lookup:
        row["missing_attribute"] = lookup[item_id]
        matched += 1
    else:
        row["missing_attribute"] = "Not Available in PostgreSQL"

print("matched attribute rows:", matched, "of", len(main["rows"]))

# quick distribution check
from collections import Counter
none_missing = sum(1 for row in main["rows"] if row["missing_attribute"] == "None missing")
na = sum(1 for row in main["rows"] if row["missing_attribute"] == "Not Available in PostgreSQL")
has_gaps = len(main["rows"]) - none_missing - na
print("none missing:", none_missing, "has gaps:", has_gaps, "not available:", na)

with io.open(SP + r"\req1_new_rows.json", "w", encoding="utf-8") as f:
    json.dump(main, f, ensure_ascii=False)

# validation spot check
for r in main["rows"]:
    if r["item_id"] == "8278561882377" and "BESTEN-BELEUCHTUNG" in r["campaign"]:
        print("VALIDATION ROW missing_attribute:", r["missing_attribute"])
