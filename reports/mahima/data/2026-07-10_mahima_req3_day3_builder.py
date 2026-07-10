# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"

def f(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

main = json.load(io.open(SP + r"\req3_fullrange_rows.json", encoding="utf-8"))
rows = main["rows"]

# row index keyed by (search_term, campaign_name, match_type_raw)
# main rows store match_type already normalized ("Performance Max (category)" vs raw "Performance Max")
# need raw match_type + campaign_id for join with daily data; rebuild from campaign name map
CAMPAIGN_NAME_TO_ID = {}
CAMPAIGN_ID_MAP = {
    "20763699505": None, "23684789991": None, "23053104908": None,
    "23431543574": None, "23926509987": None,
}
# We don't have a direct campaign_name->id map here; instead load from req3_fullrange_raw.json (has both)
raw_full = json.load(io.open(SP + r"\req3_fullrange_raw.json", encoding="utf-8"))["data"]["rows"]
name_to_id = {}
for r in raw_full:
    name_to_id[r["campaign_name"]] = r["campaign_id"]

# Build row_index using (search_term, campaign_id, match_type_raw)
row_index = {}
for i, row in enumerate(rows):
    cid = name_to_id.get(row["campaign"])
    mt_raw = "Performance Max" if row["match_type"] == "Performance Max (category)" else row["match_type"]
    row_index[(row["search_term"], cid, mt_raw)] = i

daily = json.load(io.open(SP + r"\req3_daily_raw.json", encoding="utf-8"))["data"]["rows"]
print("daily rows:", len(daily))

DAY3 = {}
skipped = 0
for r in daily:
    key = (r["search_term"], r["campaign_id"], r["match_type"])
    idx = row_index.get(key)
    if idx is None:
        skipped += 1
        continue
    date = r["date"][:10]
    cost = f(r["cost"]) if r["cost"] is not None else None
    entry = [idx, int(f(r["impressions"])), int(f(r["clicks"])),
              None if cost is None else round(cost, 2),
              round(f(r["conversions"]), 2), round(f(r["conversions_value"]), 2)]
    DAY3.setdefault(date, []).append(entry)

print("skipped:", skipped, "dates:", len(DAY3))
if DAY3:
    print("date range:", min(DAY3.keys()), "to", max(DAY3.keys()))

with io.open(SP + r"\req3_day3.json", "w", encoding="utf-8") as fo:
    json.dump(DAY3, fo, ensure_ascii=False, separators=(",", ":"))

print("wrote DAY3")
