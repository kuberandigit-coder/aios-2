# Evidence — Kamsi Requirement 6: Dropdown Summary Badges (Duplicate + Price Mismatch)

**Title:** Added a clear summary badge row at the top of each expanded duplicate group, showing Duplicate count and Price Mismatch status with a distinct colour
**Purpose:** Make Duplicate/Price Mismatch status immediately visible inside the dropdown, without adding back the removed columns
**Requirement Source:** User instruction, 2026-07-08
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## What was added
When a Duplicate?=Yes row is expanded, a single summary row now appears above the extra listing rows:
- **"Duplicate Group · N listings"** badge (indigo `#4338ca`, a distinct "official" colour not reused elsewhere in the report — green/orange/red are already used for Duplicate?/Price Mismatch? badges, so indigo clearly signals "this is a group-level summary, not another data value")
- **"Price Mismatch: Yes"** (red, reusing the existing mismatch-yes colour) or **"Price Mismatch: No"** (green) badge, so mismatch status is visible at a glance without needing a dedicated table column
- The summary row itself has a light indigo background (`#eef2ff`) to visually separate it from the plain listing rows below

## Verification performed
- Div balance: 189 open / 189 close (unchanged, pure addition)
- `node --check` syntax validation: passed, exit 0
- Functional simulation confirmed: for a known price-mismatch SKU (`12ASIP20150`), expanding shows the summary row with both the "Duplicate Group" and "Price Mismatch: Yes" badges correctly rendered
- Live deployment fetch confirmed both present in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-08_kamsi_before_req6_dropdown_badges_backup.html` — safety backup before this change

## Deployment
Deployed to Vercel production and verified live: HTTP 200, summary badges present, all 6 tabs intact.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** None
**Next Steps:** none
**PASS / FAIL:** PASS
