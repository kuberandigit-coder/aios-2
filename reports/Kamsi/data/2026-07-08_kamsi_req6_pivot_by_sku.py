import json, collections

DATA = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data"
rows = json.load(open(DATA + r"\2026-07-08_kamsi_req6_rows.json", encoding="utf-8"))

CAP = 3
by_sku = collections.defaultdict(list)
blank_rows = []
for r in rows:
    if r["sku"]:
        by_sku[r["sku"]].append(r)
    else:
        blank_rows.append(r)

pivot_rows = []
for sku, group in by_sku.items():
    group_sorted = sorted(group, key=lambda r: r["listing_url"])
    dup_count = len(group_sorted)
    is_dup = dup_count >= 2
    prices = set(g["current_price"] for g in group_sorted if g["current_price"] is not None)
    price_mismatch = is_dup and len(prices) > 1
    last_checked = group_sorted[0]["last_checked"]
    status = group_sorted[0]["product_status"]

    listings = []
    for g in group_sorted[:CAP]:
        listings.append({
            "url": g["listing_url"], "title": g["product_title"],
            "cp": g["current_price"], "xp": g["compare_price"],
        })
    extra = dup_count - CAP if dup_count > CAP else 0

    pivot_rows.append({
        "sku": sku,
        "listings": listings,
        "extra": extra,
        "duplicate": is_dup,
        "duplicate_count": dup_count,
        "price_mismatch": price_mismatch,
        "last_checked": last_checked,
        "status": status,
    })

# blank-SKU rows: one row each, treated as non-duplicate, single listing
for r in blank_rows:
    pivot_rows.append({
        "sku": "",
        "listings": [{"url": r["listing_url"], "title": r["product_title"], "cp": r["current_price"], "xp": r["compare_price"]}],
        "extra": 0,
        "duplicate": False,
        "duplicate_count": 1,
        "price_mismatch": False,
        "last_checked": r["last_checked"],
        "status": r["product_status"],
    })

print("total pivoted rows (unique SKUs + blank rows):", len(pivot_rows))
print("duplicate rows:", sum(1 for r in pivot_rows if r["duplicate"]))
print("price mismatch rows:", sum(1 for r in pivot_rows if r["price_mismatch"]))
print("rows truncated (>3 listings):", sum(1 for r in pivot_rows if r["extra"] > 0))
print("blank sku rows:", len(blank_rows))

json.dump(pivot_rows, open(DATA + r"\2026-07-08_kamsi_req6_pivot_rows.json", "w", encoding="utf-8"))
print("saved pivot rows")

# sample output for eyeballing
for r in pivot_rows[:3]:
    print(r)
