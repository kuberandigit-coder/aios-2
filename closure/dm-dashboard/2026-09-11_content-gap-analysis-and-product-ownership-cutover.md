## Purpose
Document dm-dashboard commits for 2026-09-11, recovered from the `dm-dashboard` GitHub repo (`dev-work` branch).

## Certainty
VERIFIED (commit existence) / SUPPORTED (business intent, inferred from commit messages).

## Summary (29 commits)
- **Content Gap Analysis (new dev task, Phase 1)**: added `6afae65`; Automation Runs log (dev dashboard only) `0990d96`; Blog tab added alongside Collections `47a7432`; click-a-row full detail view `66cbb17`; search box (Collections + Blog tabs) `217f0fa`; instant Analyze button (paste URL, get result) `ac2b4bc`; Analyze tries multiple search candidates, not just the first `5c33464`; quota check/cooldown/multiple-competitors-per-click `a8d3b27`; sort by most recently checked first `c84cb74`; fixed wrong competitor name display + row delete `ba4ba64`; denylist `savoo.co.uk` (voucher-aggregator false match seen live) `699b5e1`; SerpAPI quota remaining shown in header `5fa17af`.
- **E27 Competitor Analysis fixes**: stopped over-excluding plausible candidates `2fecd3a`; fixed missing competitor images (relative URL resolution) `649fa45`.
- **Competitor Lens Search fixes**: Stop button for a running search `bc490fa`; Stop button added to History rows `7fae535`; fixed History not updating (GET /runs used named SQL params) `55ec03d`; History tab + Update (re-run) + wider discovery `5cd2fe8`.
- **Product Ownership cutover (continuing from 09-09)**: Kamsi's sales product IDs cut over to the database, same pattern as Mahima `ecc2ece`; sales.py cutover finished — **all 6 staff now live from the database, auto-refreshing** `8f2f742`; `/add` endpoint updated to tag `used_in` (needed for the Kamsi migration) `7e59f21`; `POST /_conflicts/pending/add` added to migrate the rest of the team `7e37b0b`; bulk transfer by person (checkboxes + Select All) `ca4f31d`; fixed Needs Review (could never actually resolve a conflict) `5898e5f`; fixed a real Add crash (duplicate ID in one paste hit a 500) `080afe9`; styled Transfer-to dropdown, removed Jackson, fixed silent Add errors `73343ff`.
- **Bug fix**: Kamsi/Dilaksi sales — a mixed order's money now split correctly by line item `94045b0`.
- **Fix**: SKU Audit Refresh was silently failing (LED Bulbs never updated) `999fa54`.
- **UX**: Dev sidebar reordered — Overview first, rest regrouped by relatedness `7e5e464`.

## Files / Areas
New Content Gap Analysis feature (major, ~12 commits); Product Ownership migration completed for all 6 staff; several live-data correctness fixes (Kamsi/Dilaksi order splitting, SKU Audit refresh).

## Status
VERIFIED (commit existence) / SUPPORTED (business intent). Retroactive documentation, no live-test evidence recovered.

## Evidence
`dev-work` branch commits `999fa54`..`5cd2fe8` dated 2026-09-11.

## Reviewer
Pending — Kuberan

## Next step
None required unless deeper per-feature evidence is wanted. The Kamsi/Dilaksi order-splitting fix (`94045b0`) looks like the kind of correctness bug worth a dedicated evidence file if the user wants proof it was verified against real orders.
