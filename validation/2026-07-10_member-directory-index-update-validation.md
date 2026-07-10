---
task: Member Directory index.html — report counts, remove inactive member, recompute stats
date: 2026-07-10
---

## Title
Member Directory index.html Update — Validation

## Checklist

| Check | Result |
|---|---|
| Mahima card shows 3 Reports Live | PASS |
| Sonya card shows 4 Reports Live | PASS |
| Thanishtika card fully removed (0 references remaining) | PASS |
| Members stat = real count (12) | PASS |
| Active Dashboards stat = Live Reports total (24), per explicit instruction | PASS |
| Live Reports stat = sum of all active members' report counts (24) | PASS |
| Row count (12) matches 6 active + 6 pending | PASS |
| Inline JS (search filter) still valid after markup edits | PASS — `node --check` clean |
| Deployed to same file in both kuberan-web (aios-2) and Staff-requirements repos | PASS |
| Live on Vercel production | PASS |
| No PostgreSQL/database changes involved | PASS (static HTML edit only) |

## PASS / FAIL result
**PASS**
