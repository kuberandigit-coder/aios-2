---
title: Jefri Requirement 2 — Search Terms Labels, validation
date: 2026-07-22
type: validation
---

# Title
Validation — Jefri Requirement 2, tag classification logic and ROAS calculation (2026-07-22).

# Purpose
Confirm the tag classification function produces the exact expected output for every provided validation example (both the original spec's 4 examples and the revised spec's 6 examples), confirm the ROAS formula matches the worked example exactly, and confirm the live endpoint returns real, correctly-computed data.

# Checks Performed

## Original spec's 4 examples — flagged conflict, not used for final logic
The original build prompt's own validation example ("lampenschirm", clicks=763, ROAS=400%, expected Villain) directly contradicted its own stated rule text ("Hero: ROAS >= 400%") — 400% literally satisfies ">=400". This was flagged in the evidence file rather than treated as a silent pass/fail, on the reasoning that an exact 400.000...% ROAS from real cost/conversion-value division is statistically implausible and likely a rounding artifact in the prompt text. This was superseded same-day by the revision prompt before final deployment, so it did not block the task — see below.

## Revised spec's 6 examples — this IS the final logic, all verified
Ran the final `classifyTag(clicks, impressions, cost, conversions, roas)` function as a standalone unit test against all 6 examples from the revision prompt:

| # | Clicks | Impressions | Conversions | ROAS | Expected | Got | Result |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 100 | 1 | 113665% | Hero | Hero | PASS |
| 2 | 763 | 10000 | 2 | 400% | Hero | Hero | PASS |
| 3 | 763 | 10000 | 2 | 350% | Villain | Villain | PASS |
| 4 | 763 | 10000 | 0 | 0% | Villain | Villain | PASS |
| 5 | 0 | 960 | 0 | 0% | Zombie | Zombie | PASS |
| 6 | 1 | 50 | 1 | 158753% | Sidekick | Sidekick | PASS |

**Confirms Example 2 resolves the earlier Hero/Villain boundary conflict**: ROAS exactly 400% with clicks>=3 is Hero (inclusive boundary), not Villain — the final implementation uses `roas >= 400` for Hero, matching this exactly.

## ROAS formula
Worked example from the revision prompt: Conv Value = 545.59, Cost = 0.48 → expected ROAS = 113664.58%.
```
round2((545.59 / 0.48) * 100) = 113664.58
```
Computed value matches exactly (verified via a standalone Node script, not just visual inspection).

## Live endpoint verification
- `GET /api/requirement?fn=jefri-search-terms` → `success: true`, 50,768 real search-term rows (union of both source tables, Jefri's 5 campaigns, rolling 90 days from the live database, not hardcoded).
- Summary counts: 44 Hero, 396 Villain, 47,052 Zombie, 62 Sidekick (remainder ~3,214 rows correctly left untagged per the "no match → empty" rule).
- Spot-checked 3 real live rows (e.g. "* wandleuchten", PMax, 0 clicks, 2 impressions → correctly tagged Zombie).

## Deployment bug caught and fixed during this validation pass
First deploy attempt returned `{"error":"Server not configured or database unreachable..."}` for every request. Root-caused to an extra `ssl: { rejectUnauthorized: false }` option on the new isolated pg Pool that Req1's working pool config does not have. Removed to match Req1's exact config; redeployed; confirmed fixed (`success:true` on next request).

## Regression check — Req1 untouched
Confirmed Req1's `fn=jefri-product-status` dispatch line and its IIFE module were not edited (only a new line was added above it for the new dispatch, and an entirely separate new IIFE was appended after Req1's module closes). No shared state, no shared pg Pool. Live-verified Req1 still returns `200` post-deploy.

## Script-ordering bug caught and fixed (HTML/JS)
`R2_LOADED` was referenced by the tab-switch script before its `let` declaration (which was originally in a later `<script>` block). Fixed by moving the declaration into the first script block. Verified via `node -e` parsing all 3 `<script>` blocks in the deployed HTML as standalone functions — all 3 parse without syntax errors.

# Validation Result
PASS on all 6 revised-spec examples, ROAS formula, live data (not hardcoded), and Req1 non-regression.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# PASS / FAIL
PASS
