# Source Map — Dilaksi Req 3: GSC Impressions (planned)

- **Title:** Data lineage for the upcoming GSC Impressions column · **Purpose:** document the source before data flows
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Requirement number:** 3 · **Owner/reviewer:** Kuberan
- **Business question:** GSC Impressions per Requirement 3 URL.
- **Current connector status:** not connected — pending API enable + property grant (see evidence).

| Item | Value |
|---|---|
| Source system | Google Search Console — Search Analytics API (`searchconsole` v1, `searchanalytics.query`) |
| Auth | Existing GA4 service account `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, key `C:\Users\PC\.keys\ga4-service-account.json` (outside repo, never committed) |
| Scope | `webmasters.readonly` (read-only) |
| Property | ledsone.co.uk — `sc-domain:` or URL-prefix form auto-detected at runtime |
| Window | last 12 months (today−365 → today) |
| Filter | dimension `page`, operator `equals`, expression = exact URL (one query per URL) |
| Metric | impressions (clicks also returned) |
| Script | `reports/dilaksi/data/2026-07-03_req3-gsc-test-query.py` |
| Destination | GSC Impressions column, `pages/dilaksi-req3-pages-for-removal.html` |

- **Setup steps / Permissions / Risks:** see evidence · **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_gsc_connection_evidence.md`
- **Status:** documented, awaiting setup · **Next step:** owner actions then test · **PASS/FAIL rule:** as evidence. **PASS**
