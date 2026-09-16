## Mahima Search Term -> Product Mapping / STPM (REQ-DM-2026-08-MAHI01) — Handover

**What's live (per code, not confirmed live-tested):** A new tab/section on the
existing `pages/mahima.html`, implemented in `pages/mahima/search-term-product-mapping/stpm.css`, `stpm.js`.

**Architecture:** A run is stored as an **immutable snapshot** (not a live
re-query) — per the migration's own header, this is deliberate so a run from
weeks ago can be reopened and show exactly what the staff member originally saw,
even as the live Ledsone data changes underneath it.

**Data sources:** Postgres — target DB is `DILAIKSHAN_NEON_DB` with **no
fallback chain** (per `lib/stpm/config.js`) — explicitly never the Ledsone
operational DB, `AUTH_DATABASE_URL` (Thivajini feed/auth), or `NEON_DATABASE_URL`
(SEMrush/GEO).

**Important files:**
- `lib/stpm/config.js`, `repo.js`, `router.js`, `rules.js`
- `pages/mahima/search-term-product-mapping/stpm.css`, `stpm.js`
- `db/migrations/2026-08-21_005_mahima_stpm.sql`
- `scripts/stpm-migrate.js` (`npm run stpm:migrate`)
- `tests/stpm/stpm.test.js`, `tests/stpm/ui.test.js`

**Current status:** Code exists and is wired in. `ui.test.js` passes cleanly in
this recovery worktree; `stpm.test.js` fails only because `node_modules`/`pg`
isn't installed here (confirmed via isolated re-run) — not a code defect.
**Whether this has run against production, and what happened, is unknown** — no
session record or run-history log found anywhere in this AIOS.

**Pending work:** Confirm live status with Kuberan.

**Owner:** Kuberan. **Requester:** Mahima (per requirement code
`REQ-DM-2026-08-MAHI01` referenced throughout the code; no separate requirement
doc found in this AIOS).
