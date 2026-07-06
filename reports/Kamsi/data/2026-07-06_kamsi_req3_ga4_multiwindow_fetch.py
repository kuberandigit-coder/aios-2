# Kamsi Requirement 3 — Core GA4 Data for SEO, rebuilt to exactly match Dilaksi Req1's
# pattern (reports/dilaksi/data/2026-07-02_req1-ga4-multiwindow-fetch.py).
# IMPORTANT: filter is the Organic Search channel ONLY (single FilterExpression) — the
# previous Kamsi req3 fetch combined this with a landingPagePlusQueryString CONTAINS
# "/collections/" filter inside an and_group, which breaks GA4's engagementRate
# (collapses it to exactly 1 for every row — verified reproducible). Dilaksi's script
# never combines those two filters, so it never hits the bug.
import json
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric, FilterExpression, Filter, OrderBy)
from google.oauth2 import service_account

KEY = "C:/Users/PC/.keys/ga4-service-account.json"
PROP = "properties/408110563"
OUT = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/Kamsi/data/2026-07-06_kamsi_req3_ga4-organic-windows.json"

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/analytics.readonly"])
client = BetaAnalyticsDataClient(credentials=creds)

ORGANIC = FilterExpression(filter=Filter(
    field_name="sessionDefaultChannelGroup",
    string_filter=Filter.StringFilter(value="Organic Search")))
METRICS = [Metric(name="sessions"), Metric(name="activeUsers"),
           Metric(name="engagementRate"), Metric(name="userEngagementDuration"),
           Metric(name="screenPageViewsPerSession"),
           Metric(name="ecommercePurchases"), Metric(name="purchaseRevenue")]

out = {}
for days in (60, 45, 30, 15, 7):
    dr = [DateRange(start_date="%ddaysAgo" % days, end_date="today")]
    tot = client.run_report(RunReportRequest(
        property=PROP, date_ranges=dr, metrics=METRICS, dimension_filter=ORGANIC))
    t = [m.value for m in tot.rows[0].metric_values] if tot.rows else ["0"] * 7
    resp = client.run_report(RunReportRequest(
        property=PROP, date_ranges=dr,
        dimensions=[Dimension(name="landingPagePlusQueryString")],
        metrics=METRICS, dimension_filter=ORGANIC,
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=200))
    rows = [[r.dimension_values[0].value] + [m.value for m in r.metric_values]
            for r in resp.rows]
    out[str(days)] = {"totals": t, "page_count": resp.row_count, "rows": rows}
    print(days, "days: pages", resp.row_count, "sessions", t[0], "revenue", t[6], "engagementRate", t[2])

json.dump(out, open(OUT, "w", encoding="utf-8"))
print("saved", OUT)
