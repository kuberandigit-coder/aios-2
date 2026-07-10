# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
TARGET = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\mahima.html"

data = json.load(io.open(SP + r"\req3_fullrange_rows.json", encoding="utf-8"))
summary = data["summary"]
rows = data["rows"]

compact = []
for r in rows:
    compact.append({
        "st": r["search_term"], "c": r["campaign"], "mt": r["match_type"],
        "imp": r["impressions"], "cl": r["clicks"], "ctr": r["ctr"],
        "cpc": r["avg_cpc"], "co": r["cost"], "cv": r["conversions"],
        "cvr": r["conv_rate"], "va": r["conv_value"], "ro": r["roas"],
        "cpco": r["cost_per_conv"], "qi": r["query_intent"],
        "nk": r["existing_negative_kw"], "ro7": r["roas_7d"],
        "ro30": r["roas_30d"], "tr": r["trend"], "pr": r["priority"], "ac": r["action"],
    })
rows3_json = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
new_line = "const ROWS3=" + rows3_json + ";\n"

with io.open(TARGET, encoding="utf-8") as f:
    lines = f.readlines()

idx = None
for i, l in enumerate(lines):
    if l.startswith("const ROWS3="):
        idx = i
        break
assert idx is not None, "ROWS3 line not found"
lines[idx] = new_line

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Replaced ROWS3 at index", idx)
print(json.dumps(summary, indent=2))
