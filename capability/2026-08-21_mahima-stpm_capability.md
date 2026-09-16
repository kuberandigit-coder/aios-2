# Capability — Search Term -> Product Mapping (Mahima, REQ-DM-2026-08-MAHI01)

**Date:** 2026-08-21
**Owner:** Kuberan
**Staff/Requirement:** Mahima / REQ-DM-2026-08-MAHI01
**Store/Project:** digital-marketing-member-pages / Postgres (`DILAIKSHAN_NEON_DB`)
**Status:** Code complete, live usage unconfirmed (documented retroactively during 2026-09-16 AIOS recovery)

## Capability
Lets Mahima map search terms to products and reopen any past mapping run as an
immutable snapshot — exactly what was seen at the time, unaffected by later
changes to live Ledsone data.

## What Was Implemented
- 1 additive migration, `mahima_stpm_*` namespace, no DB fallback chain.
- `lib/stpm/` — config, repo, router, rules.
- New tab/section on existing `pages/mahima.html`.
- Dedicated migration runner (`scripts/stpm-migrate.js`).
- 2-file test suite.

## Technical Knowledge
Reuses the same run/snapshot pattern as `thivajini_feed_*` deliberately (per
its own migration comments), while keeping a fully separate table namespace
and DB fallback rule.

## Files / Components
See `source-map/2026-08-21_mahima-stpm-source-map.md`.

## Data Sources / Tools
PostgreSQL (`DILAIKSHAN_NEON_DB`).

## Validation
`node --test`: `ui.test.js` passes; `stpm.test.js` blocked by missing `pg` in this worktree (confirmed environmental). See `validation/mahima/2026-08-21_search-term-product-mapping-validation.md`.

## Evidence
`evidence/mahima/2026-08-21_search-term-product-mapping-schema.md`

## Limitations
Live/production run history is unconfirmed.
