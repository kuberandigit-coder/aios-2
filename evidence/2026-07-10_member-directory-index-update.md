---
task: Member Directory index.html — report counts, remove inactive member, recompute stats
date: 2026-07-10
---

## Title
Digital Marketing Member Directory (index.html) — Update Evidence

## Purpose
Record the update to `reports/digital-marketing-member-pages/index.html`: corrected report
counts for Mahima and Sonya, removal of Thanishtika (no longer active), and recomputed
directory-level stats.

## Requirement source
Kuberan, 2026-07-10 — "update mahima name card for available report count to 3 and sonya to 4
and remove thanishtika name card she is not here anymore and update the members count to real
and active dashboard count = live reports total count".

## Changes made
| Change | Before | After |
|---|---|---|
| Mahima card — Reports Live | 2 | 3 |
| Sonya card — Reports Live | 2 | 4 |
| Thanishtika card | Present (Awaiting Requirements) | Removed entirely |
| Members (masthead stat) | 13 | 12 |
| Active Dashboards (masthead stat) | 3 | 24 (per explicit instruction: = Live Reports total) |
| Live Reports (masthead stat) | 9 | 24 |
| Updated date | 2026-07-06 | 2026-07-10 |
| Awaiting Requirements section count badge | 7 | 6 |

## Calculation
Live Reports total = sum of "Reports Live" across all 6 Active Dashboards members:
Dilaksi 3 + Hetheesha 4 + Kamsi 6 + Mahima 3 + Sonya 4 + Thivajini 4 = **24**.

Members total = 6 (Active Dashboards) + 6 (Awaiting Requirements, after removing Thanishtika:
Jakshan, Jefri, Sajeepan, Sukirtha, Thasitha, Theekshy) = **12**.

Note: per the user's literal instruction ("active dashboard count = live reports total
count"), the masthead "Active Dashboards" stat was set equal to the Live Reports total (24),
not the count of members with an active dashboard (6) — that member-count is still shown
separately as the `<span class="count">6</span>` badge on the "Active Dashboards" section
heading itself.

## Validation
- `grep -c "thanishtika"` on the updated file → 0 (fully removed, no orphaned references)
- Row count check: `grep -c '<a class="row"'` → 12 (6 active + 6 pending, matches Members stat)
- Sum check: 3+4+6+3+4+4 = 24 (matches both Active Dashboards and Live Reports stats)
- Inline `<script>` block extracted and passed `node --check` (search filter JS unaffected by
  markup changes)

## Files modified
- `reports/digital-marketing-member-pages/index.html`

## Deployment
- Committed to `kuberandigit-coder/aios-2` (commit `1a49cc4`)
- Committed to `digitalmarketing69140951-sys/Staff-requirements` (commit `c7ea684`)
- Deployed to Vercel production: `dpl_Erb9nMx3cf2JepHzm8iDVWNvSZKu`, live at
  `https://digital-marketing-member-pages.vercel.app`

## Status
Done, deployed, live.

## PASS / FAIL result
**PASS**
