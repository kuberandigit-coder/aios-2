# Handover — Dilaksi Req 3: GSC Connection

- **Title:** Continuation pack — GSC Impressions for Requirement 3 · **Purpose:** any session can finish once setup is done
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Requirement number:** 3 · **Owner/reviewer:** Kuberan
- **Business question:** GSC Impressions (12m, exact page) for the pages-for-removal report.
- **Current connector status:** not connected; blocker = 2 owner actions (below). Client stack verified working.

## Owner actions required (once, ~3 min)
1. Enable API: https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=1028134974687 → Enable (log in with the Google account that owns the aios-ga4-reader project).
2. GSC → ledsone.co.uk property → Settings → Users and permissions → Add user → `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com` → **Restricted**.

## Then, in any session
- Run `python "reports\dilaksi\data\2026-07-03_req3-gsc-test-query.py"` — prints properties visible + impressions/clicks (12m) for the 5 Req 3 URLs; auto-handles domain vs URL-prefix property.
- Expected failure modes: 403 "API not used/disabled" = step 1 not done or still propagating (wait 5 min); assert "service account not added" = step 2 not done.
- On success: save output CSV to `reports/dilaksi/data/`, update the GSC Impressions column in `reports/digital-marketing-member-pages/pages/dilaksi-req3-pages-for-removal.html` (+ report copy), AIOS set, deploy only with approval.

- **Setup steps / Permissions / Risks:** see evidence · **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_gsc_connection_evidence.md`
- **Status:** waiting on owner actions · **Next step:** as above · **PASS/FAIL rule:** documentation PASS; data pull PASSes when every Req 3 URL has a real impressions value. **PASS (investigation)**
