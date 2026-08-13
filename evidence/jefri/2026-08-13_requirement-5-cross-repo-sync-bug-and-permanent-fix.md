# Evidence — jefri.html Requirement 5: Cross-Repo Sync Bug + Permanent Fix (2026-08-13)

**Purpose:** Record of a recurring class of bug (4th occurrence) finally getting a permanent, runnable safeguard instead of another one-off manual fix.

## The bug (same class as 2026-08-12's Req4 sync bug)
User reported Req5 showing all dashes/no data live, despite the tab being built and confirmed working the previous day. Root cause: `jefriReq5HandlerModule` in `api/requirement.js` (built 2026-08-12) existed in `aios-2` but was never pushed to `Staff-requirements` — the repo Vercel's `digital-marketing-member-pages` project actually deploys from. Confirmed live: before the fix, `?fn=jefri-req5` fell through silently; after, it returns the correct validation error and real row data (377 rows for a test campaign/date range).

## Immediate fix
Copied the exact `jefriReq5HandlerModule` block (lines 5232–5534) plus its dispatcher routing line from `aios-2`'s `requirement.js` into the `Staff-requirements` worktree at the identical line position, confirmed via full-file diff (byte-identical after normalizing line endings). Pushed to `Staff-requirements`.

## Audit found 2 more silent drifts
Running a full file-by-file diff between the two repos (all `api/*.js` and `pages/*.html`, 47 files) turned up:
- `pages/jefri.html` — `aios-2`'s copy had a multi-ID comma-separated search feature and the 2026-08-12 hash-clobbering fix that had **never actually been synced**, despite being reported as "confirmed deployed" in that day's AIOS docs. The earlier verification only smoke-tested via a `curl` grep for one string, not a full diff — insufficient.
- `api/members-api.js` and `pages/sajeepan.html` — the opposite direction: Piranav had pushed newer work (Sajeepan Requirement 4, Feed Optimization dashboard) directly to `Staff-requirements` that was never pulled back into `aios-2`.

All three synced in the correct direction, confirmed via full diff after.

## Permanent fix — scripts/check-repo-sync.js
Added a reusable Node script (`reports/digital-marketing-member-pages/scripts/check-repo-sync.js`) that diffs every `api/*.js` and `pages/*.html` file byte-for-byte (ignoring line-ending differences) between `aios-2` and the `Staff-requirements` worktree, and exits non-zero with a clear file list if anything is missing or mismatched in either direction. Run: `node scripts/check-repo-sync.js` from the `digital-marketing-member-pages` folder.

**Proof it works:** immediately after adding and pushing the script, running it again caught a brand-new drift (Piranav's `members-api.js` push that landed mid-session) within seconds — exactly the failure mode it's meant to catch, caught in practice on its first real use.

Saved as a standing memory (`feedback_repo_sync_check_before_ending`) — this check must run before ending any session that touches `api/` or `pages/` files, superseding the older "always push both repos" memory (which relied on remembering, not verifying).

## Files touched
- `api/requirement.js` (Staff-requirements only — content already correct in aios-2)
- `pages/jefri.html` (Staff-requirements only)
- `api/members-api.js`, `pages/sajeepan.html` (aios-2 only, pulled from Staff-requirements)
- `scripts/check-repo-sync.js` (new, both repos)

## Deployment
Deployed to production, confirmed live via direct API test (`?fn=jefri-req5` now returns real rows, not a silent fallback).

**Status:** PASS
**Reviewer:** Jefri (pending review)
**Next step:** Run `scripts/check-repo-sync.js` at the start/end of future sessions touching these files — this is now a process fix, not just a code fix.
