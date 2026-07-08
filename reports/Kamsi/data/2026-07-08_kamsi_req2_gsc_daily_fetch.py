# Kamsi Req 2 — GSC daily (per-page, per-day) performance for collection + blog pages (read-only)
# Property: sc-domain:ledsone.co.uk · Window: 2026-06-01..2026-06-30
# Replaces the PostgreSQL-mirror-sourced daily dataset with a direct GSC API pull.
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = r"C:\Users\PC\.keys\ga4-service-account.json"
SITE = "sc-domain:ledsone.co.uk"
START, END = "2026-06-01", "2026-06-30"

creds = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
gsc = build("searchconsole", "v1", credentials=creds)


def fetch(dimensions, contains):
    rows_all, start = [], 0
    while True:
        body = {"startDate": START, "endDate": END, "dimensions": dimensions,
                "dimensionFilterGroups": [{"filters": [{"dimension": "page", "operator": "contains", "expression": contains}]}],
                "rowLimit": 25000, "startRow": start}
        r = gsc.searchanalytics().query(siteUrl=SITE, body=body).execute()
        rows = r.get("rows", [])
        rows_all += rows
        if len(rows) < 25000:
            break
        start += 25000
    return rows_all


def is_scope(u):
    return ("/collections/" in u) or ("/blogs/" in u) or ("/blog/" in u)


daily_rows = []
for pat in ("/collections/", "/blogs/", "/blog/"):
    daily_rows += fetch(["page", "date"], pat)

seen = set()
clean = []
for r in daily_rows:
    u, d = r["keys"][0], r["keys"][1]
    if not is_scope(u):
        continue
    key = (u, d)
    if key in seen:
        continue
    seen.add(key)
    clean.append({
        "page": u, "date": d,
        "clicks": int(r["clicks"]), "impressions": int(r["impressions"]),
        "ctr": r["ctr"], "position": r["position"],
    })

print("total daily rows:", len(clean))
distinct_days = sorted(set(r["date"] for r in clean))
print("days covered:", len(distinct_days), distinct_days[0], "to", distinct_days[-1])
distinct_pages = set(r["page"] for r in clean)
print("distinct pages:", len(distinct_pages))

out = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req2_gsc_daily_raw.json"
json.dump(clean, open(out, "w", encoding="utf-8"))
print("saved", out)
