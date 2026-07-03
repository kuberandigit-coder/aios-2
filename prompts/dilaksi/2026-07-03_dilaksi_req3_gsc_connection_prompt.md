# Prompt — Dilaksi Req 3: GSC Connection (reusable)

- **Title:** Connect & query Google Search Console for Requirement 3 · **Purpose:** repeatable procedure once setup is done
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Requirement number:** 3
- **Business question:** GSC Impressions per URL, last 12 months, exact page filter, for the pages-for-removal report.
- **Current connector status:** no GSC connector; GA4 service account reused (API enable + property grant pending).

## Procedure
1. Verify setup done (owner): Search Console API enabled on project 1028134974687; `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com` added to ledsone.co.uk GSC property (Restricted).
2. Run `python "reports\dilaksi\data\2026-07-03_req3-gsc-test-query.py"` — auto-detects domain vs URL-prefix property, prints impressions/clicks per Requirement 3 URL.
3. On success: write results to `reports/dilaksi/data/`, fill the GSC Impressions column in `pages/dilaksi-req3-pages-for-removal.html`, save AIOS set, deploy only with approval.

- **Setup steps found / Permissions required / Risks:** see evidence file
- **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_gsc_connection_evidence.md`
- **Next step:** owner performs the 2 setup steps · **PASS/FAIL rule:** PASS if documented without secrets. **PASS**
