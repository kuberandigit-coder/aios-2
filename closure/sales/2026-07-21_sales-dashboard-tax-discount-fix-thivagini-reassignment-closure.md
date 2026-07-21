---
title: Sales Dashboard — Tax/Discount fix, reassignment, recovery closure
date: 2026-07-21
type: closure
---

# Title
Closure — 2026-07-21 sales dashboard work, second block (Gross Sales bug fix, France No-Journey-Data reassignment, deployment recovery, speed fix).

# Purpose
Close out the second half of today's session with a clear record of what shipped, what's confirmed correct, and what's still open.

# Completed & Deployed
- Fixed a real, store-wide Gross/Net Sales calculation bug: line-item discounts weren't being captured (order-level `currentTotalDiscountsSet` now correctly allocated), and tax was being included in Gross Sales (this store's prices are VAT-inclusive; now correctly excluded to match Shopify's own report convention). Verified against user-provided Shopify report screenshot, within ~0.3-0.4%.
- Added a new "Order Total (incl. tax + shipping)" reconciliation card to Hetheesha and Thivagini's tabs — verified exact match to Shopify's own Total Sales figure.
- Permanently reassigned 41 France "No Journey Data" orders from Hetheesha to Thivagini, based on real Google Ads product-click evidence within the correct 90-day pre-purchase attribution window — kept in a distinctly labeled channel ("No Journey Data (Ad-Click Matched)") for transparency, not silently merged.
- Diagnosed and recovered from a production outage caused by an unrelated GitHub auto-deploy overwriting the live site with a stale, different codebase.
- Fixed slow tab loading for Hetheesha, Thivagini, and Thasitha by generating missing static snapshot files (Jan–Jun) with the corrected calculation.
- Final sweep confirmed all 8 non-Sajeepan tabs are live, correct, and returning real July data.

# Remaining Work
1. **GitHub auto-deploy risk not resolved** — the connected "Staff-requirements" repo can silently overwrite production again at any time; user has not yet decided whether to disconnect it or otherwise address it.
2. Temporary diagnostic query flags (`debugOrderRaw`, `debugFetch`, `debugRawNoFilter`, `debugConfig`) remain in the deployed API file — harmless (opt-in only, unused by any tab), but flagged for possible cleanup.
3. Other tabs' (Mahima, Jeffri) already-cached historical snapshots were generated before today's tax/discount fix and have not been regenerated with the correction — not yet requested by user, flagged as a possible follow-up if exact historical accuracy on those tabs' Gross/Net Sales becomes important.
4. Git commit/push not yet done — this repo's standing rule requires explicit user permission before pushing; today's changes are live on Vercel production only.

# Files Modified
See evidence file: `evidence/sales/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment-evidence.md`.

# Evidence Location
`evidence/sales/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment-evidence.md`

# Validation Result
PASS — see `validation/sales/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment-validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, closed pending git push permission and the GitHub auto-deploy risk decision.

# PASS / FAIL
PASS

# Next Step
1. User to decide on the GitHub auto-deploy conflict.
2. Confirm with user whether to git commit/push today's work.
3. Decide whether to regenerate Mahima/Jeffri's historical snapshots with the corrected tax/discount calculation.
