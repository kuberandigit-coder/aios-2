# Evidence — jefri.html Requirement 4: Cross-Repo Sync Bug (2026-08-12)

**Purpose:** Record of a recurring deployment-sync defect that made R4 appear broken/stuck loading, despite the build itself being correct.

## Root cause
The `jefriReq4MappingHandlerModule` backend handler (built 2026-08-11, `ea6fa76` et al. in `api/requirement.js`) was pushed to `aios-2` but never synced to `Staff-requirements` — the repo Vercel's `digital-marketing-member-pages` project actually builds and deploys from. The live production API therefore never had this handler; requests silently fell through to an unrelated existing handler that returned SEO/blog data instead of item-mapping data, which the frontend displayed as a stuck "Loading…" spinner or wrong content.

This is the second occurrence of this exact class of bug this period (file present in one repo, missing in the other) — see also the `hourly-snapshot-cron-stale-month-bug` and the general dual-repo sync gap noted in `docs/2026-08-12_daily-work-log.md`.

## Fix
Copied the missing handler block into the `staff-req-sync3` worktree and pushed to `Staff-requirements`. No dedicated `aios-2` commit exists for this specific sync action (it only touched the other repo). Confirmed live via curl showing correct `itemId`/`parentProductId` JSON instead of the previous SEO/blog payload.

## Files touched
- `api/requirement.js` (in `Staff-requirements`, synced from `aios-2`'s existing content — no new code written)

## Deployment
Deployed to production via the `Staff-requirements` push, confirmed live.

**Status:** PASS
**Reviewer:** Jefri (pending review)
**Next step:** Reinforced the standing "always push both repos, every time" rule to prevent recurrence.
