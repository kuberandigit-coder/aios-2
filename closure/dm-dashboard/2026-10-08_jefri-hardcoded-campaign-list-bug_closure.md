# Closure — Jefri Req1-5 Hardcoded Campaign List, Permanent Fix

**Date:** 2026-10-08
**Project:** dm-dashboard

## What was done

Found and fixed a real bug: every Req (1-5) on Jefri's dashboard was scoped to a hardcoded 5-
campaign list, not his real, current campaign set. This exact bug class was already found and
fixed once before in a different, older project (the Vercel `digital-marketing-member-pages`
dashboard, 2026-08-05), but the fix was never ported into dm-dashboard. Replaced the hardcoded list
with a live, cached query against the same proven `group_name='Jefri'` source, scoped to currently
`ENABLED` campaigns only.

See `evidence/dm-dashboard/2026-10-08_jefri-hardcoded-campaign-list-bug_evidence.md` for the full
investigation.

## Separately, also done same day

A styling follow-up on Mahima's "View Owned IDs" feature: gave the button its own distinct
soft-accent look (was sharing the solid-green Refresh button's style, reading as a duplicate
action), and replaced the modal's bare search `<input>` with a proper icon-inset, pill-radius,
accent-focus-ring search field matching the rest of the dashboard. Commit `4d44609`.

## Status

**Both fixed and pushed to `dev-work`** (`c7afdc5`, `4d44609`). Not yet merged to `main`, not yet
live-verified (no browser/server access this session).

## Next step

Merge via Dev Tools, then confirm live: Jefri's Req1-5 pages show his real, current campaign
count (expected ~8, matching what was reported), and the View Owned IDs button/search look
correct in the browser.
