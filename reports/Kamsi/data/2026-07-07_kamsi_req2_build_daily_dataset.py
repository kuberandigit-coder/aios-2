import json
from urllib.parse import urlparse

daily = json.load(open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-07_kamsi_req2_daily_gsc_raw.json", encoding="utf-8"))
page_order = json.load(open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-07_kamsi_req2_page_order.json", encoding="utf-8"))

page_to_idx = {p: i for i, p in enumerate(page_order)}

# daily rows use full URLs like https://ledsone.co.uk/blogs/... ; page_order uses relative paths like /blogs/...
unmatched = 0
by_day = {}
for row in daily:
    path = urlparse(row["page"]).path
    idx = page_to_idx.get(path)
    if idx is None:
        unmatched += 1
        continue
    day = row["date"]  # 'YYYY-MM-DD'
    clicks = row["clicks"]
    impressions = row["impressions"]
    position = row["position"]
    ctr = round((clicks / impressions * 100), 2) if impressions else 0.0
    by_day.setdefault(day, []).append([idx, impressions, clicks, ctr, round(position, 1)])

print("unmatched rows:", unmatched, "of", len(daily))
print("days:", sorted(by_day.keys()))
print("rows per day (sample):", {k: len(v) for k, v in list(by_day.items())[:3]})

out = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-07_kamsi_req2_daily_by_day.json"
json.dump(by_day, open(out, "w", encoding="utf-8"), separators=(",", ":"))
print("saved", out)
