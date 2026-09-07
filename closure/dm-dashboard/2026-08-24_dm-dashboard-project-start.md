# Closure — dm-dashboard project start

**Date:** 2026-08-24
**Project:** dm-dashboard (first day)
**Source:** Claude session record (not git log)

## What was done
- Project kickoff day. Removed an earlier Blog Tool prototype from the
  main nav (not needed at this stage) and clarified the Overview page.
- **Kamsi backend ported live**: 3 Shopify-backed requirement pages
  (Slow-Moving Products, Missing Meta Title/Desc, Duplicate & Price
  Check) built and verified against real live data (`backend/app/kamsi.py`).
  Req2/3/4 flagged as not-portable yet (need GSC/GA4 credentials not
  yet configured, or duplicate of Dilaksi's page).
- **Thasitha Req4/Req5 reconstructed live**, replacing frozen static
  arrays with genuine live queries (SKU-level Shopify vs Google Ads
  comparison, multichannel CY vs PY sales) — verified against real data,
  deviations from the original brief documented and flagged for human
  confirmation (`THASITHA_PORT_NOTES.md`).
- Admin overview page: made staff cards clickable (admin-only) to jump
  directly into that staff member's pages.
- Users page: admin can change any user's password, with the change
  written to the database.
- **First-ever GitHub push** for this project: repo created
  (`websitetecteam-arch/dm-dashboard`), git initialized, remote added,
  first commit pushed — full manual terminal steps walked through since
  this was the first time doing this.
- Dev tunnel port forwarding set up (VS Code) so the app could be
  reached remotely during development.
- Drafted a professional message to the MD requesting approval to buy a
  server + set up Postgres (for employee performance tracking + future-
  proofing the dashboard long-term) — several rounds of tone/wording
  iteration, ending in a Teams-style request message.
- UI polish requests started for Kamsi (more professional look, color
  changes).

## Open items at end of day
- MD approval pending for server purchase.
- Thasitha Req4/Req5 Amazon-inclusion deviation awaiting business
  confirmation.
