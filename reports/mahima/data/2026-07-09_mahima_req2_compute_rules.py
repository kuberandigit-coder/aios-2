import json

SCRATCH = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\70f4c24d-cd7a-4f0b-8578-7ff0939371d2\scratchpad"

with open(f"{SCRATCH}\\joined_rows.json", encoding="utf-8") as f:
    rows = json.load(f)

out = []
counts = {"Fast Moving": 0, "Healthy": 0, "Slow Moving": 0, "Never Moving": 0}
action_counts = {"Restock": 0, "Monitor": 0, "Don't Restock Yet": 0, "Stop Purchasing": 0}
data_missing_sales = 0
data_missing_category = 0

for r in rows:
    sku = r["sku"]
    stock = r["current_stock"]
    sales30 = r["last_30d_sales"]
    category = r["product_type"] or "Data Missing"
    if not r["product_type"]:
        data_missing_category += 1

    if sales30 is None:
        # genuinely unknown 30-day sales for this variant (not in inventory table) -> cannot compute rule
        data_missing_sales += 1
        avg_daily = None
        days_remaining = None
        status = "Data Missing"
        action = "Data Missing"
    else:
        avg_daily = round(sales30 / 30, 2)
        if avg_daily == 0:
            days_remaining = "N/A"
            status = "Never Moving"
        else:
            days_remaining = round(stock / avg_daily) if stock is not None else None
            if days_remaining is None:
                status = "Data Missing"
            elif days_remaining <= 7:
                status = "Fast Moving"
            elif days_remaining <= 60:
                status = "Healthy"
            else:
                status = "Slow Moving"

        if status == "Fast Moving":
            action = "Restock"
        elif status == "Healthy":
            action = "Monitor"
        elif status == "Slow Moving":
            action = "Don't Restock Yet"
        elif status == "Never Moving":
            action = "Stop Purchasing"
        else:
            action = "Data Missing"

    if status in counts:
        counts[status] += 1
    if action in action_counts:
        action_counts[action] += 1

    out.append({
        "sku": sku,
        "title": r["product_title"],
        "variant": r["variant_title"],
        "category": category,
        "stock": stock,
        "sales30": sales30,
        "avgDaily": avg_daily,
        "daysRemaining": days_remaining,
        "status": status,
        "action": action,
    })

summary = {
    "total_skus": len(out),
    "status_counts": counts,
    "action_counts": action_counts,
    "data_missing_sales_rows": data_missing_sales,
    "data_missing_category_rows": data_missing_category,
}
print(json.dumps(summary, indent=2))

with open(f"{SCRATCH}\\final_rows.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)
with open(f"{SCRATCH}\\summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

print("wrote final_rows.json + summary.json")
