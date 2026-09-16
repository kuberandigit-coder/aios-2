## Sajeepan Requirement 5 — Automation Keyword Finder — Handover

**What's live (per code, not confirmed live-tested):** Tab 5 on `pages/sajeepan.html`
("Automation Keyword Finder") — UI at `pages/sajeepan/google-lens-keywords/index.html`
+ `lens.js`, backed by `lib/lens-keywords/router.js` and 19 other modules.

**Architecture:** Same Postgres-as-state-machine pattern as `thivajini_feed_*` and
`mahima_stpm_*`. A run (`google_lens_keyword_run`) processes one product at a time
(`google_lens_keyword_run_product`) via a Google Lens visual search through SerpAPI,
capturing normalized competitor results (`google_lens_keyword_competitor_result`) that
default to `NEEDS_REVIEW` until a human marks them `INCLUDED`/`EXCLUDED`
(`google_lens_keyword_competitor_review`). Reviewed results feed frequency/category
analysis, a Keyword Planner cache, attribute validation, and final title/alt-text/Ads
keyword output. A weekly-automation extension (migration 008) can run this as a fully
automatic 50-product batch instead of manual runs.

**Data sources:** SerpAPI (Google Lens engine) — two key slots (`SERP_API_1`/
`SERP_API_2`), no key values stored, only slot names and safe telemetry. Postgres:
`DILAIKSHAN_NEON_DB` (the application DB — never the Ledsone operational DB).

**Important files:**
- `lib/lens-keywords/*.js` (20 modules)
- `pages/sajeepan/google-lens-keywords/index.html`, `lens.js`
- `pages/sajeepan.html` (Requirement 5 tab mount point)
- `db/migrations/2026-08-24_006/007/008_sajeepan_lens_keywords*.sql`
- `scripts/lens-keywords-migrate.js`
- `tests/lens-keywords/*.test.js` (7 files)

**Current status:** Code exists and is wired in; 73/77 tests pass in this recovery
worktree (4 fail only because `node_modules` isn't installed here — `pg` missing,
not a code bug). **Whether this has ever run against production, and what happened,
is unknown** — no session record or run-history log was found anywhere in this AIOS.

**Known issues:** None found in the code itself. The open question is entirely
operational: has anyone actually used this feature since it was built?

**Pending work:** Confirm live status with Kuberan. If live and working, backfill
proper evidence/validation with real run data. If never run, decide whether to test
it now or leave as a built-but-unused capability.

**Owner:** Kuberan. **Requester:** Sajeepan (Ads team), per requirement code
`REQ-DM-2026-08-SAJE01` referenced throughout the code (no separate requirement doc
found in this AIOS).
