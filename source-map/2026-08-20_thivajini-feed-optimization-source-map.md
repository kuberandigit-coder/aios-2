## Thivajini Feed Optimization (DM-2026-08-THIV01) — Source Map

| Concern | File | Notes |
|---|---|---|
| Feed cycle logic | `lib/feed/cycle.js` | run-cycle state handling |
| Column definitions | `lib/feed/columns.js` | feed export columns |
| Export gate | `lib/feed/gate.js` | export-readiness gating |
| Notes/prompt | `lib/feed/notes.js`, `prompt.js` | staff-facing notes / prompt text |
| Providers | `lib/feed/providers.js` | data provider abstraction |
| DB access | `lib/feed/repo.js`, `sql.js` | targets `FEED_TRACKER_DB_URL`/`AUTH_DATABASE_URL` only |
| Session | `lib/feed/session.js` | run/session tracking |
| Validation | `lib/feed/validate.js` | input/row validation |
| Requirement 5 helper | `lib/feed/req5.js` | |
| Frontend UI | `pages/thivajini.html`, `pages/thivajini/` | Requirements Dashboard, LEDSone FR / Google Ads |
| DB schema | `db/migrations/2026-08-20_001/002_...sql`, `2026-08-21_003/004_...sql` | `thivajini_feed_*` namespace |
| Tests | `tests/feed/*.test.js` (6 files) | cycle, dbboundary, export, feed, gate, ui |
| Target database | `FEED_TRACKER_DB_URL` / `AUTH_DATABASE_URL` env vars | never the Ledsone operational DB |

## Verification status
Confirmed via direct file read and `grep` cross-check (2026-09-16 recovery pass).
Live/production data flow NOT VERIFIED — no run-history record exists in this AIOS.
