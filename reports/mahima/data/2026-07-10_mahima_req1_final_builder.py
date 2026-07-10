# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"

def f(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

CAMPAIGN_ID_MAP = {
    "Pmax DE | Mahi | Klarna | DE | All_Myid | MCV": "20763699505",
    "Pmax DE | Mahi | Shoptimised|  BESTEN-BELEUCHTUNG | priceGT10_5 | MCV": "23684789991",
    "Pmax DE | Mahi | Shoptimised | LIGHTINGSOLUTION | All_Myid_1 | MCV": "23053104908",
    "Pmax DE | Mahi | Shoptimised |JAN-TOP-SALES | JanTopSales_3 | MCV": "23431543574",
    "Shopping DE | Mahi | klarna | TOP-MAHI | Verkaufsprodukt | tROAS | 11/06": "23926509987",
}
ATTR_LABELS = {
    "product_category": "product_category", "item_group_id": "item_group_id", "mpn": "mpn",
    "color": "color", "condition": "condition", "description": "description",
    "product_types": "product_types", "availability": "availability", "brand": "brand", "price": "price",
}

# ---------------- 1. Full-range (Jan1-Jul9) base aggregate ----------------
full = json.load(io.open(SP + r"\req1_fullrange_raw.json", encoding="utf-8"))["data"]["rows"]

rows = []
for r in full:
    impressions = f(r["impressions"])
    clicks = f(r["clicks"])
    conversions = f(r["conversions"])
    conv_value = f(r["conversion_value"])
    cost = f(r["cost"])
    roas = (conv_value / cost) if cost > 0 else 0.0
    title = r.get("title")

    missing = []
    for col, label in ATTR_LABELS.items():
        v = r.get(col)
        if v is None or v == "":
            missing.append(label)
    if title is None:
        missing_attr = "Not Available in PostgreSQL"
    elif missing:
        missing_attr = ", ".join(missing)
    else:
        missing_attr = "None missing"

    rows.append({
        "campaign": r["campaign_name"],
        "item_id": r["product_item_id"],
        "product": title if title else None,
        "impressions": int(impressions),
        "clicks": int(clicks),
        "conversions": round(conversions, 2),
        "cost": round(cost, 2),
        "conv_value": round(conv_value, 2),
        "roas": round(roas, 2) if cost > 0 else 0,
        "status": "Not Available in PostgreSQL",
        "missing_attribute": missing_attr,
    })

rows.sort(key=lambda x: x["cost"], reverse=True)

# row index for daily-data mapping: (campaign_id, item_id) -> row position
row_index = {}
for i, row in enumerate(rows):
    cid = CAMPAIGN_ID_MAP.get(row["campaign"])
    row_index[(cid, row["item_id"])] = i

# ---------------- 2. 7-day and 30-day ROAS (fixed anchor = today) ----------------
d7 = json.load(io.open(SP + r"\req1_7d_raw.json", encoding="utf-8"))["data"]["rows"]
seven = {}
for r in d7:
    key = (r["campaign_id"], r["product_item_id"])
    seven[key] = {"cost": f(r["cost_7d"]), "va": f(r["conv_value_7d"])}

thirty = json.load(io.open(SP + r"\req1_new_raw.json", encoding="utf-8"))["data"]["rows"]
thirty_lookup = {}
for r in thirty:
    # req1_new_raw rows don't carry campaign_id directly; campaign_name is present
    cid = CAMPAIGN_ID_MAP.get(r["campaign_name"])
    thirty_lookup[(cid, r["product_item_id"])] = {"cost": f(r["cost"]), "va": f(r["conversion_value"])}

for row in rows:
    cid = CAMPAIGN_ID_MAP.get(row["campaign"])
    s7 = seven.get((cid, row["item_id"]), {"cost": 0.0, "va": 0.0})
    s30 = thirty_lookup.get((cid, row["item_id"]), {"cost": 0.0, "va": 0.0})
    row["roas_7d"] = round((s7["va"] / s7["cost"]) * 100, 1) if s7["cost"] > 0 else 0
    row["roas_30d"] = round((s30["va"] / s30["cost"]) * 100, 1) if s30["cost"] > 0 else 0

summary = {
    "total_rows": len(rows),
    "total_impressions": sum(x["impressions"] for x in rows),
    "total_clicks": sum(x["clicks"] for x in rows),
    "total_cost": round(sum(x["cost"] for x in rows), 2),
    "total_conv_value": round(sum(x["conv_value"] for x in rows), 2),
    "total_conversions": round(sum(x["conversions"] for x in rows), 2),
    "products_missing_title": sum(1 for x in rows if x["product"] is None),
    "distinct_campaigns": len(set(x["campaign"] for x in rows)),
    "none_missing_count": sum(1 for x in rows if x["missing_attribute"] == "None missing"),
    "has_gaps_count": sum(1 for x in rows if x["missing_attribute"] not in ("None missing", "Not Available in PostgreSQL")),
}
summary["overall_roas"] = round(summary["total_conv_value"] / summary["total_cost"], 2) if summary["total_cost"] > 0 else 0

print(json.dumps(summary, indent=2))

# validation
for r in rows:
    if r["item_id"] == "8278561882377" and "BESTEN-BELEUCHTUNG" in r["campaign"]:
        print("VALIDATION ROW:", json.dumps(r, ensure_ascii=False))

with io.open(SP + r"\req1_final_rows.json", "w", encoding="utf-8") as fo:
    json.dump({"summary": summary, "rows": rows}, fo, ensure_ascii=False)

# ---------------- 3. Daily data for range picker (Jan1 - Jul9) ----------------
DAY1 = {}
chunk_files = ["jan", "feb", "mar", "apr", "may1", "may2", "jun1", "jun2", "jul"]
total_daily = 0
skipped = 0
for cf in chunk_files:
    d = json.load(io.open(SP + f"\\req1_daily_{cf}.json", encoding="utf-8"))["data"]["rows"]
    total_daily += len(d)
    for r in d:
        key = (r["campaign_id"], r["product_item_id"])
        idx = row_index.get(key)
        if idx is None:
            skipped += 1
            continue
        date = r["date"][:10]
        entry = [idx, int(f(r["impressions"])), int(f(r["clicks"])), round(f(r["cost"]), 2), round(f(r["conversions"]), 2), round(f(r["conversion_value"]), 2)]
        DAY1.setdefault(date, []).append(entry)

print("daily rows total:", total_daily, "skipped:", skipped, "dates:", len(DAY1))
print("date range:", min(DAY1.keys()), "to", max(DAY1.keys()))

with io.open(SP + r"\req1_day1_final.json", "w", encoding="utf-8") as fo:
    json.dump(DAY1, fo, ensure_ascii=False, separators=(",", ":"))

print("wrote DAY1 final")
