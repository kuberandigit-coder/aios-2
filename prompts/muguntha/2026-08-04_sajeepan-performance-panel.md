# Prompt — Muguntha Dashboard: Sajeepan Panel (2026-08-04)

**Original user ask (paraphrased):**

"Build Sajeepan out next on the Muguntha DM Dashboard with the exact same data pipeline, formulas, and UI treatment already proven for Sonya" — following on from the earlier same-day session that built Sonya's real-data panel and left the other 11 members (Jefri, Dilaksi, Kamsi, Mahima, Thasitha, Sukirtha, Sajeepan, Theekshy, Jackson, Hetheesha, Thivajini) as "Coming soon" placeholders.

Context supplied with the ask (already confirmed, reused without re-derivation):
- Sonya's Sales side pulls from `/api/sales25?group=sonya&month=YYYY-MM` (2025) and `/api/salesuk?group=sonya&month=YYYY-MM` (2026); both already support `group=sajeepan` too.
- Sonya's Cost side = own Google Ads campaign-group cost + her product-share of the shared "DM 46" campaign (`campaign_id=20810136438`), computed in `api/muguntha.js`.
- Sajeepan's Google Ads campaign group is `SAJEEPAN` (all caps, `account_id=4503486236`) — confirmed via `SELECT DISTINCT group_name FROM google_ads.campaigns WHERE account_id=4503486236`.
- Sajeepan's owned-product Set (`SAJEEPAN_PRODUCT_IDS_UK`) already existed in `api/salesuk.js` for Sales attribution but wasn't exported for reuse — export it the same way `SONYA_PRODUCT_IDS_UK` was exported.
- Build Sajeepan with DM-cost-included-for-both-years from the start (no need to replicate Sonya's earlier same-day back-and-forth on whether 2025 should include DM cost).
- Generalize `api/muguntha.js` to accept an employee param rather than duplicate the file, if that's the cleaner diff (it was).
- Generate snapshots directly via SQL (ledsone-db-mcp) rather than round-tripping through the live endpoint 19+ times, for speed — same approach used for Sonya's Jul-Dec 2025 snapshots earlier the same day.
- Confirm the "DM Dashboard" branding rename (already done by a prior quick edit — just verify, don't re-do).
- Do NOT touch `evidence/sukirtha/`, `validation/sukirtha/`, `handover/sukirtha/`, `prompts/sukirtha/`, `reports/sukirtha/`, `vercel/sukirtha/` files with `SUK-R6` in the filename — separate task awaiting user approval to deploy, must not be staged/committed alongside this work.
