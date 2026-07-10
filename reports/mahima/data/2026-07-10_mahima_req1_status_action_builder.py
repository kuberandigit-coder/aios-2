# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"

CAMPAIGN_ID_MAP = {
    "Pmax DE | Mahi | Klarna | DE | All_Myid | MCV": "20763699505",
    "Pmax DE | Mahi | Shoptimised|  BESTEN-BELEUCHTUNG | priceGT10_5 | MCV": "23684789991",
    "Pmax DE | Mahi | Shoptimised | LIGHTINGSOLUTION | All_Myid_1 | MCV": "23053104908",
    "Pmax DE | Mahi | Shoptimised |JAN-TOP-SALES | JanTopSales_3 | MCV": "23431543574",
    "Shopping DE | Mahi | klarna | TOP-MAHI | Verkaufsprodukt | tROAS | 11/06": "23926509987",
}

data = json.load(io.open(SP + r"\req1_final_rows_v2.json", encoding="utf-8"))
rows = data["rows"]

lookup_rows = json.load(io.open(SP + r"\req1_lookup_fixed.json", encoding="utf-8"))["data"]["rows"]
avail_lookup = {r["product_item_id"]: r.get("availability") for r in lookup_rows}

status_rows = json.load(io.open(SP + r"\req1_status_raw.json", encoding="utf-8"))["data"]["rows"]
status_lookup = {(r["campaign_id"], r["product_item_id"]): r["status"] for r in status_rows}
print("status_lookup entries:", len(status_lookup))

def title_case_avail(v):
    if v is None or v == "":
        return None
    return v.strip().title()  # "in stock" -> "In Stock", "out of stock" -> "Out Of Stock"

na = "Not Available in PostgreSQL"

action_counts = {}
status_filled = 0
for row in rows:
    cid = CAMPAIGN_ID_MAP.get(row["campaign"])
    real_status = status_lookup.get((cid, row["item_id"]))
    if real_status:
        row["status"] = real_status
        status_filled += 1
    # else keep existing "Not Available in PostgreSQL"

    feed_status_raw = avail_lookup.get(row["item_id"])
    feed_status = title_case_avail(feed_status_raw)
    row["feed_status"] = feed_status if feed_status else na

    missing_attr = row["missing_attribute"]
    roas = row["roas"]  # e.g. 1.78 means 178%

    if feed_status is None:
        action = na
    elif feed_status.lower() == "out of stock":
        action = "Pause"
    elif missing_attr != "None missing":
        action = "Optimize"
    elif roas == 0:
        action = "Pause"
    elif roas >= 4.0:
        action = "Scale"
    elif roas >= 2.5:
        action = "Maintain"
    else:
        action = "Reduce"

    row["action"] = action
    action_counts[action] = action_counts.get(action, 0) + 1

print("status filled (real ELIGIBLE etc.):", status_filled)
print("action distribution:", json.dumps(action_counts, indent=2))

# validation row
for r in rows:
    if r["item_id"] == "8278561882377" and "BESTEN-BELEUCHTUNG" in r["campaign"]:
        print("VALIDATION:", json.dumps(r, ensure_ascii=False))

with io.open(SP + r"\req1_final_rows_v3.json", "w", encoding="utf-8") as fo:
    json.dump(data, fo, ensure_ascii=False)

print("wrote", len(rows), "rows")
