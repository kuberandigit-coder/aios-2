# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"

d = json.load(io.open(SP + r"\req1_new_raw.json", encoding="utf-8"))
rows_in = d["data"]["rows"]

def f(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

out = []
for r in rows_in:
    impressions = f(r["impressions"])
    clicks = f(r["clicks"])
    conversions = f(r["conversions"])
    conv_value = f(r["conversion_value"])
    cost = f(r["cost"])
    roas = (conv_value / cost) if cost > 0 else 0.0
    title = r.get("title")
    out.append({
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
        "missing_attribute": "Not Available in PostgreSQL",
    })

out.sort(key=lambda x: x["cost"], reverse=True)

summary = {
    "total_rows": len(out),
    "total_impressions": sum(x["impressions"] for x in out),
    "total_clicks": sum(x["clicks"] for x in out),
    "total_cost": round(sum(x["cost"] for x in out), 2),
    "total_conv_value": round(sum(x["conv_value"] for x in out), 2),
    "total_conversions": round(sum(x["conversions"] for x in out), 2),
    "products_missing_title": sum(1 for x in out if x["product"] is None),
    "distinct_campaigns": len(set(x["campaign"] for x in out)),
}
summary["overall_roas"] = round(summary["total_conv_value"] / summary["total_cost"], 2) if summary["total_cost"] > 0 else 0

print(json.dumps(summary, indent=2))

with io.open(SP + r"\req1_new_rows.json", "w", encoding="utf-8") as fo:
    json.dump({"summary": summary, "rows": out}, fo, ensure_ascii=False)

print("wrote", len(out), "rows")

# validation spot-check
for x in out:
    if x["item_id"] == "8278561882377" and "BESTEN-BELEUCHTUNG" in x["campaign"]:
        print("VALIDATION ROW:", json.dumps(x, ensure_ascii=False))
