# Kamsi Req 3 — Core GA4 Data for SEO: ALL collection landing pages, Organic Search, last 30 days.
# Reuses Dilaksi Req 2 GA4 fetch pattern (2026-07-02_req2-ga4-fetch-script.py) + Kamsi Req 2 GSC pattern.
# GA4 = source of truth for metrics; GSC = query enrichment only (GA4 has no organic query dimension).
import csv
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter,
    FilterExpressionList, OrderBy)
from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = r"C:\Users\PC\.keys\ga4-service-account.json"
PROP = "properties/408110563"
START, END = "2026-06-06", "2026-07-05"  # last 30 complete days

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/analytics.readonly",
                 "https://www.googleapis.com/auth/webmasters.readonly"])
client = BetaAnalyticsDataClient(credentials=creds)

rows_all, offset = [], 0
while True:
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date=START, end_date=END)],
        dimensions=[Dimension(name="landingPagePlusQueryString")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers"),
                 Metric(name="engagementRate"), Metric(name="userEngagementDuration"),
                 Metric(name="screenPageViewsPerSession"), Metric(name="purchaseRevenue")],
        dimension_filter=FilterExpression(and_group=FilterExpressionList(expressions=[
            FilterExpression(filter=Filter(
                field_name="sessionDefaultChannelGroup",
                string_filter=Filter.StringFilter(value="Organic Search"))),
            FilterExpression(filter=Filter(
                field_name="landingPagePlusQueryString",
                string_filter=Filter.StringFilter(
                    value="/collections/", match_type=Filter.StringFilter.MatchType.CONTAINS))),
        ])),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=10000, offset=offset)
    resp = client.run_report(req)
    for r in resp.rows:
        rows_all.append([r.dimension_values[0].value] + [m.value for m in r.metric_values])
    if offset == 0: print("GA4 row count:", resp.row_count)
    offset += 10000
    if offset >= resp.row_count: break

with open("2026-07-06_kamsi_req3_ga4_organic_collections_30d.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["landing_page", "sessions", "active_users", "engagement_rate",
                "user_engagement_duration_sec", "pages_per_session", "purchase_revenue"])
    w.writerows(rows_all)
print("GA4 saved:", len(rows_all))

# --- GSC: top query per collection landing page, same 30-day window ---
gsc = build("searchconsole", "v1", credentials=creds)
best, start = {}, 0
while True:
    body = {"startDate": START, "endDate": END, "dimensions": ["page", "query"],
            "dimensionFilterGroups": [{"filters": [{"dimension": "page", "operator": "contains", "expression": "/collections/"}]}],
            "rowLimit": 25000, "startRow": start}
    r = gsc.searchanalytics().query(siteUrl="sc-domain:ledsone.co.uk", body=body).execute()
    rows = r.get("rows", [])
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
