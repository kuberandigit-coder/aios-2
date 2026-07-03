# Closure — Dilaksi Req 3: GSC Connection Investigation

- **Title:** GSC connection method found and documented · **Purpose:** close the investigation task
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Requirement number:** 3 · **Owner/reviewer:** Kuberan
- **Business question:** How to pull GSC Impressions (12m, exact page) for Requirement 3.

## Outcome
GSC is **not** currently connected. Best method confirmed: **reuse the existing GA4 service account** (`aios-ga4-reader@…iam.gserviceaccount.com`) — the Python client stack is installed and was live-tested; the only blockers are (1) enabling the Search Console API on Cloud project 1028134974687 (one click, exact URL documented) and (2) adding the service-account email to the ledsone.co.uk GSC property with Restricted permission. A ready-made test script pre-loaded with the 5 Requirement 3 URLs is saved. No secrets exposed or committed. **RAG: AMBER — method GREEN, but 2 owner actions pending before data can flow.**

- **Current connector status / Setup steps / Permissions / Risks:** see evidence
- **Files created:** evidence, prompt, validation, closure, handover, source-map + `reports/dilaksi/data/2026-07-03_req3-gsc-test-query.py`
- **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_gsc_connection_evidence.md` · **Validation result:** PASS
- **Status:** investigation complete · **Next step:** owner performs the 2 setup steps, then run the test script; on success fill the GSC Impressions column in the Req 3 page and redeploy (with approval)
- **PASS/FAIL rule:** PASS if method+permissions+steps+test plan documented in AIOS without secrets. **PASS**
