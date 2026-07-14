---
title: SUK-R3 — Slow-Moving Summary
requirement_id: SUK-R3
type: evidence
---

# Title
SUK-R3 — Slow-Moving Summary

# Requirement ID
SUK-R3

# Purpose
Document the exact Status rule and its boundary-condition behavior.

# Requirement Source
`prompts/sukirtha/SUK-R3-slow-moving-stock-prompt.md`

# Business Question
Which variants are Slow-Moving?

# Shopify Store
ledsone.de

# Shopify Objects Checked
`ProductVariant`, `InventoryItem` (for tracked flag + stock), merged
Units Sold (90d) from Order/LineItem (see `SUK-R3-90-day-sales-method.md`).

# Shopify Fields Used
Derived fields only at this stage: `currentStock`, `inventoryTracked`,
`unitsSold90d` (all computed upstream).

# Status Rule
```js
function computeStatus(unitsSold, currentStock, tracked) {
  if (!tracked || currentStock === null) return 'Not Assessable';
  if (unitsSold < 10 && currentStock > 100) return 'Slow-Moving';
  return 'OK';
}
```
Strict `<` and `>` only — never `<=`/`>=`, matching the requirement
exactly.

# Boundary Verification (by code review against the exact logic above)
| Units Sold | Current Stock | Tracked | Expected | Logic Result |
|---|---|---|---|---|
| 9 | 101 | yes | Slow-Moving | `9<10 && 101>100` → true → Slow-Moving ✓ |
| 10 | 101 | yes | OK | `10<10` → false → OK ✓ |
| 9 | 100 | yes | OK | `100>100` → false → OK ✓ |
| 0 | 150 | yes | Slow-Moving | `0<10 && 150>100` → true → Slow-Moving ✓ |
| 9 | n/a | no | Not Assessable | `!tracked` → true → Not Assessable ✓ |

All 5 required boundary cases from the spec pass by direct logic
inspection. Live-data confirmation (finding real variants matching each
case) is pending deploy approval.

# Files Modified
`reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`

# Evidence Location
This file.

# Validation Result
See `validation/sukirtha/SUK-R3-validation-report.md`.

# Owner
Kuberan (AIOS) / Claude Code session

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead / Inventory Owner — pending

# Status
Logic verified by code review; live numbers pending deploy approval.

# Known Limitations
Preliminary Slow-Moving count could not be generated in this session
because deployment (required to execute the serverless function against
live Shopify data) is explicitly withheld by this requirement.

# Duplicate-Truth Risk
None.

# Parent AIOS Candidate Status
Not promoted.

# Next Step
Deploy approval → run live → confirm boundary cases against real
matching variants, not just logic review.

# PASS / FAIL
PASS (logic); PENDING (live data)
