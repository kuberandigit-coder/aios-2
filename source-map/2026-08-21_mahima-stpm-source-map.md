## Mahima STPM (REQ-DM-2026-08-MAHI01) — Source Map

| Concern | File | Notes |
|---|---|---|
| Config / DB access | `lib/stpm/config.js` | `DILAIKSHAN_NEON_DB`, no fallback chain |
| Repository | `lib/stpm/repo.js` | immutable snapshot storage |
| Router | `lib/stpm/router.js` | request dispatch |
| Rules | `lib/stpm/rules.js` | mapping/classification rules |
| Frontend UI | `pages/mahima/search-term-product-mapping/stpm.css`, `stpm.js` | new tab on existing `pages/mahima.html` |
| DB schema | `db/migrations/2026-08-21_005_mahima_stpm.sql` | `mahima_stpm_*` namespace |
| Migration runner | `scripts/stpm-migrate.js` | `npm run stpm:migrate` |
| Tests | `tests/stpm/stpm.test.js`, `tests/stpm/ui.test.js` | |
| Target database | `DILAIKSHAN_NEON_DB` env var | never the Ledsone operational DB or other app DBs |

## Verification status
Confirmed via direct file read and `grep` cross-check (2026-09-16 recovery pass).
Live/production data flow NOT VERIFIED — no run-history record exists in this AIOS.
