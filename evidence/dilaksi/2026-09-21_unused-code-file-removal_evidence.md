# Evidence — Unused Code File Audit + Removal

Date: 2026-09-21
Repo: dm-dashboard (branch: dev-work, commit `1c1e160`)

## Audit method

Grep-verified, not guessed -- same standard as the earlier unused-database-table audit. For every backend
`.py` file, checked all relative/absolute import styles plus the `dev_tasks/__init__.py` central
registration pattern. For every frontend `.jsx`/`.js` file, checked static `import`, dynamic `import()`
(this project's `taskRegistry.js` uses `load: () => import('./path')` extensively), and the
taskRegistry.js + AdminLayout.jsx + DevLayout.jsx triple-registration pattern. Entry points (`main.py`,
package-root `__init__.py` files, `main.jsx`, `App.jsx`) were excluded from "unused" since they're never
imported by definition but are legitimately used.

## Results

- Backend: 191 `.py` files checked -- 10 entry points (expected), 175 confirmed used, 6 unused.
- Frontend: 147 `.jsx`/`.js` files checked -- 2 entry points (expected), 144 confirmed used, 1 unused.
- Total: 7 unused files found. 3 of the 7 were documented (via code comments or `git log`) as
  intentionally kept, not accidental orphans:
  - `backend/app/dev_tasks/geo_visibility/aio_serpapi.py` -- documented working fallback AI-Overview
    provider, deliberately not wired in.
  - `backend/app/gsc_live_sync.py` -- a git commit explicitly states it's "kept in repo but not imported
    or triggered" (also the file responsible for the earlier `apscheduler` 502 incident, since disabled).
  - `backend/app/jefri_ai_assistant.py` -- superseded per `jefri_ai.py`'s own docstring, kept for
    reference.

## User decision

Asked the user explicitly whether to remove all 7 or only the 4 genuine leftovers, since deleting
intentionally-preserved code is a materially different action than deleting accidental dead code. User
chose: **remove only the 4 genuine leftovers**, leave the 3 documented ones untouched.

## Files removed (commit `1c1e160`, `dev-work` branch, NOT yet pushed to remote)

- `backend/app/response_cache.py` -- zero references anywhere in the codebase; an abandoned caching
  utility.
- `backend/app/sajeepan_lens_alt_text.py` -- zero references; only imports from other modules, never
  imported itself.
- `backend/app/sajeepan_lens_eligibility.py` -- zero references, same pattern.
- `frontend/src/components/MyTaskLog.jsx` (885 lines) -- a "personal task log" component, zero imports
  anywhere.

## Verification performed after removal

- `python -c "from app.main import app"` -- backend still imports cleanly, no broken import chain.
- `npx vite build` -- frontend still builds cleanly; only the same pre-existing
  `INEFFECTIVE_DYNAMIC_IMPORT` warning class every sibling dev-task page already produces, no new errors.

## No secrets

No credentials of any kind were touched by this cleanup -- purely dead-code removal.

## Status

Committed locally to `dev-work` (commit `1c1e160`). **Not yet pushed** -- per this project's standing rule,
push only happens on explicit instruction.
