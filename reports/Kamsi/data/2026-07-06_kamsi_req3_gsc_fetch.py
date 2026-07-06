# Kamsi Req 3 — GSC top query per /collections/ page, last 30 days (2026-06-06..2026-07-05)
# Uses requests transport (httplib2 was timing out in this environment).
import csv, requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

KEY = r"C:\Users\PC\.keys\ga4-service-account.json"
SITE = "sc-domain:ledsone.co.uk"
START, END = "2026-06-06", "2026-07-05"

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
creds.refresh(Request())
H = {"Authorization": f"Bearer {creds.token}"}
URL = f"https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aledsone.co.uk/searchAnalytics/query"

best, start = {}, 0
while True:
    body = {"startDate": START, "endDate": END, "dimensions": ["page", "query"],
            "dimensionFilterGroups": [{"filters": [{"dimension": "page", "operator": "contains", "expression": "/collections/"}]}],
            "rowLimit": 25000, "startRow": start}
    r = requests.post(URL, json=body, headers=H, timeout=120)
    r.raise_for_status()
    rows = r.json().get("rows", [])
    for row in rows:
        u, q, imp = row["keys"][0], row["keys"][1], int(row["impressions"])
        if u not in best or imp > best[u][1]: best[u] = (q, imp)
    if len(rows) < 25000: break
    start += 25000

with open("2026-07-06_kamsi_req3_gsc_top_query_30d.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["page_url", "top_query", "impressions"])
    for u, (q, imp) in sorted(best.items()): w.writerow([u, q, imp])
print("GSC pages with query:", len(best))
