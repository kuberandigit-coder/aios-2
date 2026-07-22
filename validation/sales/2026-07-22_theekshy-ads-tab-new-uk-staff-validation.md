---
title: Theekshy Google Ads Tab — New UK Staff validation
date: 2026-07-22
type: validation
---

# Title
Validation — new Theekshy Google Ads tab, UK store, utm_term match, March–July (2026-07-22).

# Purpose
Confirm the new tab is correctly scoped (store, timezone, month range, matching rule) and deployed, consistent with the exact user requirement.

# Checks Performed

## Code review
- Confirmed `theekshy-ads` staff resolution added alongside the existing `sajeepan-ads` entry in `handleOrganic()`'s staff-param ternary, and `isUkStaff` correctly extended to include both (`sajeepan-ads` OR `theekshy-ads`), so the UK token/domain/API-version env vars are used for both.
- Confirmed the new handler block uses a single-term `Set(['theekshy'])` exact-match (lowercased comparison against `utm.term`) — matches the user's explicit instruction ("her utm term is THEEKSHY"), deliberately not reusing Sajeepan's campaign-name matching approach, since this is a different, simpler, user-confirmed rule for a different person.
- Confirmed snapshot-name mapping added (`theekshy-uk-ads`) consistently in both the API's `handleOrganic()` snapshot-path lookup and the `generate-snapshots.js` tool's `SNAPSHOT_NAME_BY_STAFF` map — keeps the permanent snapshot tool usable for her without further script edits.

## HTML/JS review
- Confirmed month tabs are **March–June + July (live) only** — no January/February tab rendered, consistent with "she join on march so start from march month tab to June and July live."
- Confirmed all `tk`-prefixed globals/functions/element IDs are unique in the file (grepped for `tk[A-Z]` prefix collisions against existing `th`/`sj`/etc. prefixes — none found).
- Confirmed store/timezone strings read `ledsone.co.uk` / Europe/London throughout (header, footnote, period label), not copy-pasted DE/FR text.

## Deployment
- `vercel --prod --yes` completed with `readyState: READY`.
- Live data confirmation (an actual `staff=theekshy-ads&month=2026-03` fetch showing real matched orders) was requested but the check was interrupted before completing — **not yet independently confirmed live**, only code-reviewed and deployed.

# Validation Result
PASS on code correctness, scoping (store/timezone/month range/matching rule), and deployment. **Open**: a live fetch confirming real matched orders/financials for March–July has not yet completed.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# PASS / FAIL
PASS (scope: implementation correctness + deployment). Live data confirmation is the immediate next step, not a failure of this task.
