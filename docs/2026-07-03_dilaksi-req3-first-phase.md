# 2026-07-03 — Dilaksi Requirement 3: First-Phase Data Collection (Pages for Removal)

URLs supplied by user (5). Collected per URL: GA4 organic sessions last 12 months (property 408110563), Shopify live status (collections/products/pages/redirects + HTTP), header/footer/sitemap link inspection. Results: wall-light live+linked with 237 organic sessions/12m; the other 4 URLs are 404, absent from Shopify (all statuses), unlinked, no redirects, 0 sessions. Nothing guessed; no deploy. Backlinks pending (no Semrush connector).

- Data table: `reports/dilaksi/2026-07-03_dilaksi_req3_first_phase_data_notes.md`
- Evidence: `evidence/dilaksi/2026-07-03_dilaksi_req3_first_phase_ga4_shopify_website_evidence.md`
- Validation/closure/handover/source-map/vercel: same-named 2026-07-03 files

**PASS/FAIL:** PASS (phase 1)

---

## Update — Req 3 page built & deployed (2026-07-03)

Built `pages/dilaksi-req3-pages-for-removal.html` (member-pages design: header w/ generated date, website, reporting period, connector sources; summary cards; 7-column table with per-cell methodology notes) + report copy `reports/dilaksi/dilaksi-requirement-3-pages-for-removal.html`. Backlinks column = "Pending — Semrush"; GSC Impressions/Recommended Action blank per requirement. Deployed `dpl_EaTsnS4W4ZH17KwhKLskLg9Z6Mxn`; live verified (200, 5 rows); Req 1/Req 2 pages unaffected (200/200).

Live: https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req3-pages-for-removal.html

**PASS/FAIL:** PASS

---

## Update — GSC connection investigated (2026-07-03)

GSC not connected. Best method: reuse the GA4 service account (aios-ga4-reader@…). Live API test pinpointed the exact blocker: Search Console API disabled on Cloud project 1028134974687. Two owner actions documented (enable API via exact URL + add service-account email to ledsone.co.uk GSC property as Restricted). Ready test script: `reports/dilaksi/data/2026-07-03_req3-gsc-test-query.py` (5 Req 3 URLs, 12m, exact-page filter). No secrets exposed. AIOS set saved (…_dilaksi_req3_gsc_connection_*). PASS (investigation); AMBER pending owner actions.

### GSC connected & impressions live (2026-07-03)
Owner enabled the API + granted property access. Test query PASS: sc-domain:ledsone.co.uk visible (Restricted). Impressions 12m: wall-light 148,429 (87 clicks); other 4 URLs 0. Column filled, deployed dpl_6TSEbaN2CSAQQ9VMJtFnbv2KSGoP, live verified. Only Semrush backlinks remain.

### Index card updated (2026-07-03)
Added R3 button ("Pages for Removal — last 12 months") to the Dilaksi expander card on index.html, matching the R1/R2 buttons; card text now "3 pages available". Deployed dpl_354jB9QCuQLH4K8QoFSX2msUUBsF; live verified (index 200 with R3 link, req3 page 200, R1/R2 unaffected).
