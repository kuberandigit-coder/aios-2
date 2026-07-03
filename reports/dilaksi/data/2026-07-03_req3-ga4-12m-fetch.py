import csv
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric, FilterExpression,
    FilterExpressionList, Filter)
from google.oauth2 import service_account

KEY = "C:/Users/PC/.keys/ga4-service-account.json"
PROP = "properties/408110563"
OUT = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/dilaksi/data/2026-07-03_req3-ga4-organic-12m.csv"

PATHS = ["/collections/wall-light", "/pages/summer-sale-2023",
         "/products/discontinued-lamp-x", "/pages/old-landing-black-friday",
         "/products/spider-light-v1-old"]

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/analytics.readonly"])
client = BetaAnalyticsDataClient(credentials=creds)

results = []
for path in PATHS:
    req = RunReportRequest(
        property=PROP,
        date_ranges=[DateRange(start_date="365daysAgo", end_date="today")],
        dimensions=[Dimension(name="landingPagePlusQueryString")],
        metrics=[Metric(name="sessions")],
        dimension_filter=FilterExpression(and_group=FilterExpressionList(expressions=[
            FilterExpression(filter=Filter(
                field_name="sessionDefaultChannelGroup",
                string_filter=Filter.StringFilter(value="Organic Search"))),
            FilterExpression(filter=Filter(
                field_name="landingPagePlusQueryString",
                string_filter=Filter.StringFilter(
                    match_type=Filter.StringFilter.MatchType.BEGINS_WITH, value=path))),
        ])),
        limit=1000)
    resp = client.run_report(req)
    total = 0
    variants = []
    for r in resp.rows:
        lp = r.dimension_values[0].value
        # exact URL only: path itself or path + query string
        if lp.split("?")[0].rstrip("/") == path:
            n = int(r.metric_values[0].value)
            total += n
            variants.append((lp, n))
    results.append([path, total, len(variants)])
    print(path, "organic sessions 12m:", total, "| matched landing-page variants:", len(variants))
    for lp, n in variants[:5]:
        print("   ", lp, n)

with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["path", "organic_sessions_12m", "landing_page_variants_matched"])
    w.writerows(results)
print("saved", OUT)
