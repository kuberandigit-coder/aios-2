# Closure — Jefri Req2 Date-Range Fix

**Date:** 2026-10-08
**Project:** dm-dashboard

## What was done

Live-verified the campaign-list fix on the production server (SSH, direct SQL against the
business DB) and found a second, real bug along the way: Req2's query window was hardcoded to
"last 90 days" with no UI control to change it, silently hiding real historical data (161k+ rows
confirmed) for 6 of Jefri's 7 non-Shopping campaigns, whose upstream feed stopped updating around
2026-07. Added optional From/To date params (backend + frontend), defaulting to the prior 90-day
behaviour.

See `evidence/dm-dashboard/2026-10-08_jefri-req2-missing-date-range_evidence.md` for the full
investigation and `evidence/dm-dashboard/2026-10-08_jefri-hardcoded-campaign-list-bug_evidence.md`
for the campaign-list fix this followed on from.

## Live verification performed this session

Deployed the campaign-list fix to production directly (SSH into the Contabo server, `git pull`,
`systemctl restart dm-dashboard`), confirmed via `grep`/`git log` that the fix code was actually
running, and confirmed live in the browser that all 8 campaigns now show (was 5). The date-range
fix (this closure) was pushed but **not yet deployed/live-verified** — session ended before that
step.

## Status

**Campaign-list fix: fixed, deployed, live-verified.** **Date-range fix: fixed, pushed to
`dev-work`, not yet deployed.**

## Next step

Merge `dev-work` → `main`, deploy (same `git pull` + `systemctl restart dm-dashboard` on the
Contabo server), then confirm live that the From/To controls work and reveal the real historical
data for the affected campaigns.
