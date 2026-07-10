# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
TARGET = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\mahima.html"

data = json.load(io.open(SP + r"\req1_new_rows.json", encoding="utf-8"))
rows = data["rows"]

compact = []
for r in rows:
    compact.append({
        "c": r["campaign"], "id": r["item_id"], "p": r["product"],
        "cl": r["clicks"], "imp": r["impressions"], "cv": r["conversions"],
        "co": r["cost"], "va": r["conv_value"], "ro": r["roas"],
        "st": r["status"], "ma": r["missing_attribute"],
    })
rows1_json = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
new_line = "const ROWS1=" + rows1_json + ";\n"

with io.open(TARGET, encoding="utf-8") as f:
    lines = f.readlines()

idx = None
for i, l in enumerate(lines):
    if l.startswith("const ROWS1="):
        idx = i
        break
assert idx is not None, "ROWS1 line not found"
lines[idx] = new_line

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("Replaced ROWS1 line at index", idx, "- new length", len(new_line))
