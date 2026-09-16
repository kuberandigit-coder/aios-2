## Purpose
Document the Mahima "Search Term -> Product Mapping" (STPM) feature (REQ-DM-2026-08-MAHI01) found in code but missing any evidence/validation/closure trail, discovered during AIOS historical recovery (2026-09-16).

## Certainty
Code existence and wiring: VERIFIED. Original business intent/prompt: SUPPORTED (reconstructed from code comments). Live/production usage: NOT VERIFIABLE.

## What exists
- Migration: `db/migrations/2026-08-21_005_mahima_stpm.sql` — additive, target DB explicitly `DILAIKSHAN_NEON_DB` (never the Ledsone operational DB, never `AUTH_DATABASE_URL`/`NEON_DATABASE_URL`/`FEED_TRACKER_DB_URL` — no fallback chain, per `lib/stpm/config.js`).
- Design intent per migration header: a run must be reopenable weeks later and show exactly what the staff member originally saw, even as live Ledsone data changes underneath it — so a run is stored as an **immutable snapshot**, not a live re-query.
- Application layer: `lib/stpm/config.js`, `repo.js`, `router.js` (referenced in `package.json`'s `check` script) and related modules.
- UI: `pages/mahima.html` (existing Mahima dashboard) + `pages/mahima/search-term-product-mapping/stpm.css`, `stpm.js` — a new tab/section added to her existing page (consistent with how Sajeepan's lens-keywords and Thivajini's feed dashboard were each added as a new tab on an existing or new per-staff page).
- Migration runner: `scripts/stpm-migrate.js` (separate `npm run stpm:migrate` script).
- Tests: `tests/stpm/stpm.test.js`, `tests/stpm/ui.test.js`.

## Test run (this recovery session, 2026-09-16)
`node --test` on `tests/stpm/*.test.js` (run together with `tests/feed/*.test.js`, 8 files total): 244/245 passed; the 1 failure is in `tests/stpm/stpm.test.js`. Isolated re-run (`node --test tests/stpm/stpm.test.js` alone) confirms: `MODULE_NOT_FOUND: 'pg'` at import (`lib/stpm/config.js` -> `lib/stpm/rules.js` -> the test file) — same environment/dependency gap as the Sajeepan lens-keywords suite (this worktree has no `node_modules` installed), not a code defect. `tests/stpm/ui.test.js` passed cleanly.

## What is NOT verifiable
- Whether the migration was run against the live database.
- Whether the feature has been used by Mahima/Kuberan since being built.
- The original prompt/requirement conversation (REQ-DM-2026-08-MAHI01 referenced in code only).

## Status
PARTIAL / SUPPORTED — code exists, is wired into the existing Mahima page, and its DB-independent test (`ui.test.js`) passes; the DB-dependent test fails only due to the missing `pg` package in this worktree (confirmed by isolated re-run). Live/deployed behavior is NOT VERIFIABLE from this worktree.

## Reviewer
Pending — flagged for Kuberan to confirm live status.

## Next step
Confirm with Kuberan whether this feature is live/in use.
