# Closure — Theekshy + Sonya No-Journey-Data Reassignment Analysis

**Date:** 2026-07-22

## Summary
Investigated reassigning Kamsi's/Dilaksi's "No Journey Data" orders to Theekshy/Sonya where real Google Ads click evidence pointed to their campaigns (90-day pre-purchase window, same method used elsewhere on this dashboard).

- **Theekshy:** 19 orders found with credible (~5%) click evidence from her 2 narrow campaigns. Built, deployed live, then explicitly reverted same day by the user pending "admin permission." Revert confirmed clean (never committed, snapshots regenerated, live-verified back to original state, zero residue in git or the shared repo).
- **Sonya:** 84 of ~192 orders showed some click overlap, but her 19 broad campaigns cover 5,759 products (near-full catalog) — a ~44% match rate that is not credible as genuine ad influence. Correctly NOT implemented. User deferred a decision on approach ("we will work on tomorrow").

## Linked files
- Docs: `docs/2026-07-22_theekshy-sonya-nojourneydata-reassignment-analysis.md`
- Evidence: `evidence/sales/2026-07-22_theekshy-sonya-nojourneydata-reassignment-evidence.md`
- Validation: `validation/sales/2026-07-22_theekshy-sonya-nojourneydata-reassignment-validation.md` — PASS

## Status
- Theekshy: REVERTED, PENDING admin permission before redoing. Do not re-implement until that is confirmed resolved.
- Sonya: NOT IMPLEMENTED, PENDING user decision on approach (leave as-is / stricter signal / other). Do not implement a blanket reassignment from the current 84-order match list.

**Reviewer:** User directed the Theekshy revert directly; both open items require user sign-off before further code changes.
**Next step:** Re-check admin-permission status before touching Theekshy's code again; get user's chosen approach before touching Sonya's code at all.
