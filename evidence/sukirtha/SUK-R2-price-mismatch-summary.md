---
title: SUK-R2 — Price Mismatch Summary
requirement_id: SUK-R2
type: evidence
---

# Title
SUK-R2 — Price Mismatch Summary

# Requirement ID
SUK-R2

# Purpose
Prove current-price and compare-at-price mismatch detection uses numeric
comparison (not formatted-string comparison) and correctly treats null vs
populated compare-at as different states.

# Requirement Source
`prompts/sukirtha/SUK-R2-duplicate-listing-price-check-prompt.md`

# Business Question
Do duplicate SKU listings have different current prices or compare-at
prices?

# Shopify Store
ledsone.de

# Shopify Objects and Fields Checked
`ProductVariant.price`, `ProductVariant.compareAtPrice` — both cast with
`Number(...)` before comparison in `api/sukirtha-req2-duplicate-check.js`
and the offline parser, never compared as formatted currency strings.

# Price-Mismatch Rule
`Price Mismatch = Duplicate=Yes AND count(distinct numeric price) > 1`.

# Compare-at Price Mismatch Rule
`Compare-at Mismatch = Duplicate=Yes AND count(distinct compare-at state) > 1`,
where each listing's state is either `'null'` (no compare-at price) or the
stringified numeric value — so one listing with a compare-at price and
another with none is treated as two different states, per the requirement.

# Results (live pull, 2026-07-14T04:32:24.543Z)
| Metric | Value |
|---|---|
| Current Price Mismatches | 742 |
| Compare-at Price Mismatches | 613 |

# Verified examples (sampled live during discovery)
- `CRSF100YB-IDE` — 2 listings, €6.75 and €5.74 → Price Mismatch = Yes
- `CRFF100GB+HKR10GB-IDE` — 2 listings, €6.69 and €5.69 → Price Mismatch = Yes
- `CRFF100WH+HKR10WH-IDE` — 2 listings, both €5.64 → Price Mismatch = No
- `CRSF108CO+HKR10CO-IDE` vs `CRSF108CO2PK+HKR10CO2PK-IDE` type variants —
  compare-at €8.99 vs €0.00 on sibling variants within the same product —
  confirms the compare-at check correctly flags a populated-vs-different-
  populated case, not just null-vs-populated.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`

# Evidence Location
This file; raw data at `reports/sukirtha/data/2026-07-14_suk-r2_sku_groups.json`.

# Validation Result
See `validation/sukirtha/SUK-R2-validation-report.md`.

# Owner
Kuberan (AIOS) / Claude Code session

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead — pending

# Status
Live, deployed.

# Known Limitations
A `compareAtPrice` of `"0.00"` (seen on some variants, e.g. `CRFF108BM-IDE`)
is treated as a real populated value (distinct from `null`), matching
Shopify's own data as returned — not re-interpreted as "no compare-at
price." This is a data-quality characteristic of the source catalog, not a
logic bug.

# Duplicate-Truth Risk
See `SUK-R2-duplicate-sku-evidence.md`.

# Parent AIOS Candidate Status
Not promoted.

# Next Step
Business Validator review of whether the €0.00 compare-at edge case above
should be treated as "no compare-at" in a future iteration.

# PASS / FAIL
PASS
