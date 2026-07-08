# Vercel Placement Notes — Kamsi Requirement 6: Duplicate Listing & Price Check

**Title:** Vercel placement recommendation for the new Req6 tab (not yet deployed)
**Purpose:** Document exactly where and how this would deploy, pending approval
**Requirement Source:** GPT planning layer instruction, 2026-07-08
**Business Question:** N/A (infrastructure record)
**PostgreSQL Sources Checked:** N/A
**External Sources Checked:** N/A

## Recommendation
- **Target:** `reports/digital-marketing-member-pages` Vercel project (same project serving all Kamsi/Dilaksi/Mahima/Sonya pages)
- **File:** `pages/kamsi-req1-slow-moving-products.html` (the merged 6-tab page; Req6 is the new tab 6) — no other files need changing, `index.html`'s Kamsi link already points to this same URL
- **Command:** `vercel deploy --prod` from `reports/digital-marketing-member-pages/`
- **Recommended pre-deploy check:** Kuberan review of the 1,430 price-mismatch SKUs (see handover file) — some of these may represent real pricing bugs worth fixing in Shopify before or alongside making this audit visible
- **Sync:** after deploying, the same file also needs pushing to the shared `Staff-requirements` repo (same pattern used for every prior Kamsi tab addition)

## What actually happened
**Nothing deployed.** Built and fully validated locally only, per this task's explicit "do not deploy without approval" instruction. No `vercel deploy` command was run for this requirement.

**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Not deployed — awaiting approval
**Known Limitations:** None beyond the above
**Next Steps:** Kuberan approval, then run the recommended deploy + sync steps
**PASS / FAIL:** PASS
