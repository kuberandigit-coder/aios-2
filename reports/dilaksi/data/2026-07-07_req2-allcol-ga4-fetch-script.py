import csv, sys
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter, OrderBy)
from google.oauth2 import service_account

KEY = "C:/Users/PC/.keys/ga4-service-account.json"
PROP = "properties/408110563"
OUT = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/dilaksi/data/2026-07-07_req2-allcol-ga4-organic-landing-30d.csv"

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/analytics.readonly"])
client = BetaAnalyticsDataClient(credentials=creds)

rows_all = []
offset = 0
while True:
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
        dimensions=[Dimension(name="landingPagePlusQueryString")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers"),
                 Metric(name="engagementRate"), Metric(name="userEngagementDuration"),
                 Metric(name="screenPageViewsPerSession"), Metric(name="purchaseRevenue")],
        dimension_filter=FilterExpression(filter=Filter(
            field_name="sessionDefaultChannelGroup",
            string_filter=Filter.StringFilter(value="Organic Search"))),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=10000, offset=offset)
    resp = client.run_report(req)
    for r in resp.rows:
        rows_all.append([r.dimension_values[0].value] + [m.value for m in r.metric_values])
    if offset == 0:
        print("total row count:", resp.row_count)
    offset += 10000
    if offset >= resp.row_count:
        break

with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["landing_page", "sessions", "active_users", "engagement_rate",
                "user_engagement_duration_sec", "pages_per_session", "purchase_revenue"])
    w.writerows(rows_all)
print("saved rows:", len(rows_all))
print("top 5:")
for r in rows_all[:5]:
    print(r)
