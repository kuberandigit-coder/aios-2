## Purpose
Per Kuberan: "remove vat and add transection fee for 2026 sakes also".

## Changes
1. Removed VAT entirely from the Total Cost formula and cost-breakdown popup for Sonya and Sajeepan. Total Cost is now: Ads Cost + Product Cost (20% of Net Sales) + Transaction Fee + Discount + Refund + Shopify Subscription share.
2. Found that 2026 sales snapshots (`salesuk-{sonya,sajeepan}-2026-*.json`) had the same field-drift issue discovered earlier today — deployed snapshots were missing the `vat`/`transactionFee` fields added 2026-08-07, same as the 2025 files. Regenerated via live `refresh=1` calls.

## Regeneration results
14 months attempted (7 each for Sonya/Sajeepan, 2026-01 through 2026-07):
- **11 succeeded**: Sonya Apr/May/Jun/Jul, Sajeepan Jan/Feb/Mar/Apr/Jun/Jul (Sajeepan May already had the field from an earlier Aug 7 generation).
- **3 failed**: Sonya Jan/Feb/Mar 2026 — repeated attempts (including a dedicated retry at 150s timeout) all failed with no response. Given consistent, repeatable failure (not just slowness) across multiple attempts throughout the session, this looks like a genuine Shopify-side issue specific to those 3 months, not a timeout-tuning problem. Left for a follow-up session.

Some regenerated months also had small netSales deltas (e.g. Sonya 2026-04: £19,301.65 → £19,273.45) — expected, reflects late order status changes (refunds/cancellations) between the old and new generation dates, not a new bug.

## Files changed
- `pages/muguntha.html` (VAT removal)
- `api/data/salesuk-sonya-2026-{04,05,06,07}.json`, `api/data/salesuk-sajeepan-2026-{01,02,03,04,06,07}.json` (10 files, regenerated)

## Evidence
- Live-verified: `/api/salesuk?group=sonya&month=2026-05` now returns `transactionFee: 550.05` (was absent).
- Live-verified: muguntha.html's deployed HTML no longer contains the VAT popup row.
- Committed and pushed to both repos: Staff-requirements (commit 5a8443f), aios-2 (commit 25f08bd), plus the earlier VAT-removal code commits (Staff-requirements f029538, aios-2 a482384).
- Deployed to production, verified live.

## Status
PASS for VAT removal and 11/14 months' Transaction Fee fix. Sonya's Jan/Feb/Mar 2026 still show £0.00 Transaction Fee — known gap, not yet resolved.

## Reviewer
Kuberan

## Next step
Retry regenerating `salesuk-sonya-2026-01.json`/`-02`/`-03` in a follow-up session — investigate whether it's a genuine Shopify API issue specific to those months (worth checking Shopify's status page or trying at a different time of day) rather than just retrying blindly again.
