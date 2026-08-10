# Evidence — Muguntha Dashboard: Target Achievement Redefinition + YoY Growth % Column (2026-08-10)

**Purpose:** Record of two same-day metric redefinitions on `muguntha.html`, applied across all 5 built members (Sonya, Sajeepan, Kamsi, Dilaksi, Jefri).

## 1. Target Achievement redefined as 30% YoY Sales growth (`d33f6cb`)
Previously: ROAS / 30% target (an ad-spend-efficiency ratio). User clarified they actually want a year-on-year Sales growth target: this month's 2026 Sales measured against 2025's same-month Sales + 30% (e.g. Jan 2025 £50k → Jan 2026 target £65k). 100% = hit the growth target exactly. Net/ROAS columns unchanged, they simply no longer feed Target Achievement. Footnotes updated for all 5 members.

## 2. YoY Growth % column added (`1eb1d8e`)
Target Achievement (2026 Net / (2025 Net × 1.30)) was being misread by the user as a raw growth figure. Added a distinct YoY Growth % = (2026 Net − 2025 Net) / 2025 Net (e.g. -7.10% if Net fell) so raw change and target-achievement ratio are both visible without confusion. Applied across all 5 members.

## 3. Target Achievement basis correction — Net, not Sales (`71a3f6c`)
Corrected same day: the growth target comparison uses 2026 **Net** against a 30%-YoY-growth target on 2025 **Net** (Sales − Cost), not raw Sales as first implemented in step 1. Footnotes updated to match for all 5 members.

**Net result (end of day):** Target Achievement = 2026 Net / (2025 Net × 1.30). YoY Growth % = (2026 Net − 2025 Net) / 2025 Net — a separate, non-target-relative figure.

## Files touched
- `reports/digital-marketing-member-pages/pages/muguntha.html`

## Deployment
Deployed to production, verified live.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None called out in commit messages.
