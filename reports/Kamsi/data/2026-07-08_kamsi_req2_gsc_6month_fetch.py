# Kamsi Req 2 — GSC 6-month (2026-01-01 to 2026-06-30) page-level totals + target keyword
# Property: sc-domain:ledsone.co.uk
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = r"C:\Users\PC\.keys\ga4-service-account.json"
SITE = "sc-domain:ledsone.co.uk"
START, END = "2026-01-01", "2026-06-30"

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


# Page-level totals (6-month aggregate per URL)
page_rows = []
for pat in ("/collections/", "/blogs/", "/blog/"):
    page_rows += fetch(["page"], pat)
pages = {}
for r in page_rows:
    u = r["keys"][0]
    if not is_scope(u):
        continue
    if u in pages:
        continue
    pages[u] = {"clicks": int(r["clicks"]), "impressions": int(r["impressions"]), "ctr": r["ctr"], "position": r["position"]}
print("pages in scope:", len(pages))

# top keyword per page
best = {}
for pat in ("/collections/", "/blogs/", "/blog/"):
    for r in fetch(["page", "query"], pat):
        u, q = r["keys"][0], r["keys"][1]
        if not is_scope(u):
            continue
        imp = int(r["impressions"])
        if u not in best or imp > best[u][1]:
            best[u] = (q, imp)
print("pages with a query:", len(best))

rows = []
for u, m in sorted(pages.items(), key=lambda x: -x[1]["impressions"]):
    kw = best.get(u, ("", 0))[0]
    rows.append([u, kw, m["impressions"], m["clicks"], round(m["ctr"] * 100, 2), round(m["position"], 1)])

print("total rows:", len(rows))
print("total impressions:", sum(r[2] for r in rows), "total clicks:", sum(r[3] for r in rows))

json.dump(rows, open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req2_6month_pages.json", "w", encoding="utf-8"))
print("saved 6-month aggregate rows")
