# GSC test query for Requirement 3 — run AFTER the two setup steps in
# evidence/dilaksi/2026-07-03_dilaksi_req3_gsc_connection_evidence.md are done.
# Read-only. Key path only — no secrets in this file.
from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = "C:/Users/PC/.keys/ga4-service-account.json"
SITE_CANDIDATES = ["sc-domain:ledsone.co.uk", "https://ledsone.co.uk/"]
PAGES = ["https://ledsone.co.uk/collections/wall-light",
         "https://ledsone.co.uk/pages/summer-sale-2023",
         "https://ledsone.co.uk/products/discontinued-lamp-x",
         "https://ledsone.co.uk/pages/old-landing-black-friday",
         "https://ledsone.co.uk/products/spider-light-v1-old"]

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
svc = build("searchconsole", "v1", credentials=creds)

sites = svc.sites().list().execute().get("siteEntry", [])
print("properties visible:", [(s["siteUrl"], s["permissionLevel"]) for s in sites])
site = next((c for c in SITE_CANDIDATES if any(s["siteUrl"] == c for s in sites)), None)
assert site, "service account not added to the ledsone.co.uk GSC property yet"

from datetime import date, timedelta
end = date.today(); start = end - timedelta(days=365)
for page in PAGES:
    resp = svc.searchanalytics().query(siteUrl=site, body={
        "startDate": start.isoformat(), "endDate": end.isoformat(),
        "dimensions": ["page"],
        "dimensionFilterGroups": [{"filters": [
            {"dimension": "page", "operator": "equals", "expression": page}]}],
        "rowLimit": 10}).execute()
    rows = resp.get("rows", [])
    imp = sum(r["impressions"] for r in rows)
    clk = sum(r["clicks"] for r in rows)
    print(page, "-> impressions(12m):", imp, "clicks:", clk)
