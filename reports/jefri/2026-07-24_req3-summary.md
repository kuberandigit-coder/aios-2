---
title: Jefri Requirement 3 (T-03) — 3-Period Product Comparison, summary report
date: 2026-07-24
type: report
---

# Requirement Summary
New live dashboard tab (Requirement 3) comparing each product's Conv. Value and ROAS across three fixed calendar-quarter windows — Previous 3M (Oct-Dec 2025), Last 3M (Jan-Mar 2026), and Prior-Year 3M (Apr-Jun 2025) — flagging Improved/Same/Drop status and a High/Mid Performance Tier by revenue-contribution rank + ROAS.

# Requester
Jefri, Google Ads department.

# Business Question
Which products improved, stayed the same, or dropped in performance across the three named periods, and which should receive additional advertising budget (High/Mid tier) vs. require investigation?

# Purpose
Give Jefri a fixed-quarter (not rolling-window) view of product trajectory, complementing Requirement 1's rolling-90-day Hero/Villain/Zombie/Sidekick tags with a period-over-period comparison and a revenue-weighted tier system.

# PostgreSQL Source Inspected (read-only)
- `google_ads.product_performance` — same table as Requirement 1, columns `date, campaign_id, product_item_id, impressions, clicks, conversions, conversion_value, cost`.
- `listings.shopify_listings` / `listings.shopify_listings_parent_child_mapping` — same SKU-resolution join already used by Requirement 1 (no new tables, no invented columns).
- Confirmed scope: Jefri's 5 named campaigns (same `JEFRI_CAMPAIGN_IDS` as Requirement 1).
- Confirmed data availability before building: `product_performance` for these 5 campaigns spans 2025-05-12 to 2026-07-24 (453,016 rows). Oct-Dec 2025 (43,696 rows) and Jan-Mar 2026 (156,939 rows) are fully covered; Apr-Jun 2025 (19,413 rows) has a real gap — zero rows before 2025-05-12 (campaigns didn't exist/weren't tracked yet).

# Business Rules Implemented
- **Tier** (based on Last 3M only): High = ROAS ≥ 400% AND top 20% by Last-3M Conv. Value rank. Mid = ROAS 200-399% AND 30th-50th percentile by Last-3M Conv. Value rank. Neither → no tier.
- **Status** (Last 3M vs. Previous 3M, using Conv. Value OR ROAS — either metric can trigger it): Improved if either metric's % change ≥ +15%. Drop if either ≤ -30%. Same if either is between -10% and +14%. A change matching none of these bands (or with no Previous-3M baseline) is left undefined (`—`), since the specification doesn't define that gap and inventing a rule to fill it wasn't authorized.
- Precedence when Conv. Value and ROAS disagree: Improved checked first, then Drop, then Same — an unavoidable interpretation of "using Conv. Value OR ROAS" that isn't otherwise specified; documented here rather than silently assumed.

# Files Modified
- `reports/digital-marketing-member-pages/api/requirement.js` — new `jefriReq3Handler` inside the existing `jefriProductStatusHandlerModule` (reuses `getPool()`, `JEFRI_CAMPAIGN_IDS`, `CHANNEL`), dispatcher entry `fn=jefri-req3`.
- `reports/digital-marketing-member-pages/pages/jefri.html` — new "Requirement 3" tab, table (grouped 3-period column headers, Tier/Status columns, sticky header, sortable, search, Tier/Status filters, pagination, Export CSV + Export Excel), IndexedDB persistence (`jefri_r3_live`, same pattern as Req1/Req2 added 2026-07-24 earlier today).

# Evidence Path
`evidence/jefri/2026-07-24_req3-3period-comparison-evidence.md`

# Validation
`validation/jefri/2026-07-24_req3-3period-comparison-validation.md` — PASS. SQL query tested directly against production Postgres before implementation; live endpoint hit post-deploy returns real, non-hardcoded data (4,791 products; 166 High tier, 0 Mid tier — confirmed genuine via a direct percentile+ROAS spot-check query, not a bug).

# Owner
Owner: Jefri · Implemented by: Claude Code (this session) · Reviewer: pending.

# Known Limitations
- Mid tier currently has 0 matching products — verified genuine (no product in the 30th-50th percentile band happens to also have 200-399% ROAS in the current data), not a calculation defect.
- Prior-Year 3M (Apr-Jun 2025) is missing Apr 1 - May 11 2025 data entirely (pre-dates campaign tracking) — disclosed in the footnotes, not backfilled or estimated.
- "Export Excel" is a lightweight HTML-table-as-`.xls` download (Excel opens it natively) rather than a true `.xlsx` binary, since no xlsx library exists anywhere else in this codebase and adding one wasn't in scope for this task.
- Status/Tier gaps left as `—` where the spec's own thresholds don't cover a case (e.g. -11% to -29% change) — not filled in with invented logic.

# Next Step
Jefri review of the Improved/Same/Drop distribution and the High/Mid tier list against his own expectations; confirm the Conv. Value-vs-ROAS precedence assumption for Status matches his intent.

# PASS / FAIL
PASS
