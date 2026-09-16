## Purpose
Document the Sajeepan "Automation Keyword Finder" (REQ-DM-2026-08-SAJE01) database schema found in code but missing any evidence/validation/closure trail, discovered during AIOS historical recovery.

## Certainty
**UPDATED after deeper cross-check (see below): VERIFIED that a full feature was built**, not just a schema. No session/conversation record for this task exists in the AIOS structure, so business intent/original prompt remains SUPPORTED (reconstructed), but code existence, wiring, and partial test results below are VERIFIED directly from the repository.

## Correction to initial recovery pass
The first version of this file (written before this cross-check) only found the
3 SQL migrations and assumed no application code existed. A follow-up
`grep` across `reports/digital-marketing-member-pages` for `google_lens_keyword`/
`lens-keyword` found a complete, wired feature:
- `lib/lens-keywords/` — 20 modules (router, phase1, analysis, automation, weekly,
  serpapi, cache, quota, eligibility, competitor-filter, review, keyword-planner,
  google-ads, gemma, title, alt-text, attributes, final-output, export, errors,
  normalize, sql, config).
- `pages/sajeepan/google-lens-keywords/index.html` + `lens.js` — the tab's UI,
  injected into `pages/sajeepan.html` as **Requirement 5 ("Automation Keyword
  Finder")**, tab id `req5`/`req5Panel`, confirmed present in the live page
  markup (`grep` on `pages/sajeepan.html` lines ~373-412, ~2248-3626).
- `scripts/lens-keywords-migrate.js` — a dedicated migration runner (separate
  from `stpm-migrate.js`), confirming this was treated as a first-class
  sub-system, not a one-off script.
- `tests/lens-keywords/` — 6 test files (logic, phase1, serpapi, security, ui,
  analysis-logic, automation — 7 files, one omitted from `npm test` originally
  listed as run together with the feed/stpm suites in `package.json`).

## Test run (this recovery session, 2026-08-24 files, run 2026-09-16)
`node --test` against all 7 lens-keywords test files: **73 passed, 4 failed**.
All 4 failures are `MODULE_NOT_FOUND: 'pg'` at import time (`lib/lens-keywords/
config.js` requires the `pg` package) — **this worktree has no `node_modules`
installed** (confirmed: `node_modules/` absent entirely), so this is an
environment/dependency-install issue in the recovery worktree, not a code
defect. The 73 passing tests (UI/layout/security/logic tests that don't need a
live DB connection) ran and passed cleanly, including:
- tab-5 wiring, Req1-4 panels untouched, `switchReqTab` toggling correctly
- no API key ever shown to the user (generation provenance check)
- dark/light theme completeness, no sideways scroll, keyboard focus states
- filters/history are read-only and cannot trigger a paid provider call

## Business Question / Requirement
REQ-DM-2026-08-SAJE01 — Automation Keyword Finder: same-SKU product -> Google Lens visual search -> competitor result capture -> human review -> (per migration 007) frequency/category analysis, Keyword Planner cache, attribute validation, final title/alt text and Ads keyword output -> (per migration 008) a fully automatic weekly 50-product workflow.

## What The Schema Shows Was Built (3 migrations, all dated 2026-08-24)

**006 — `sajeepan_lens_keywords.sql`** (Phase 1 core):
- `google_lens_keyword_run` — one row per run; state machine `CREATED -> PREPARING -> SEARCHING_PRODUCTS -> BUILDING_RESULTS -> COMPLETED[_WITH_WARNINGS]/FAILED`; idempotency key so a double-click/refresh/Vercel retry never re-spends SerpAPI credits.
- `google_lens_keyword_run_product` — one row per product per run, immutable snapshot (SKU, title, image, attributes at time of search) plus per-product state `WAITING -> RUNNING -> SUCCESS/NO_VISUAL_MATCHES/MISSING_IMAGE/FAILED`; one product failing cannot fail the whole run.
- `google_lens_keyword_competitor_result` — normalized Lens results (image/url/title/etc.), explicitly "NEVER fabricated DOM fields" — a field is populated only if the provider genuinely returned it.
- `google_lens_keyword_provider_attempt` — safe telemetry (status, latency, credits before/after); never stores an API key value, only a `key_slot` name (`SERP_API_1`/`SERP_API_2`).
- `google_lens_keyword_quota_snapshot` — SerpAPI account quota numbers only (plan, searches left) — never account email/API key/account ID.
- `google_lens_keyword_competitor_review` + view — append-only human review trail; every automated match defaults to `NEEDS_REVIEW`, never auto-validated.
- Target DB is explicitly `DILAIKSHAN_NEON_DB` (the application DB) — the migration header repeats, in caps, that this must never touch the Ledsone operational DB or the other app DB URLs (`AUTH_DATABASE_URL`/`NEON_DATABASE_URL`/`FEED_TRACKER_DB_URL`/`DATABASE_URL`).

**007 — `sajeepan_lens_keywords_full.sql`** (Stages 4-12, additive):
- Extends the same namespace for the full requirement: frequency/category analysis, Phase 2 expansion, Keyword Planner cache, attribute validation, final title/alt text, final Ads keyword output.
- Deliberately keeps a *separate* analysis-phase state machine rather than merging into migration 006's `status` column, because Stage 3 is a human gate ("use only INCLUDED competitor results") and the Lens-search-finished state must stay independently meaningful.

**008 — `sajeepan_lens_keywords_automation.sql`** (weekly automation, additive):
- Adds `batch_type` (`MANUAL`/`WEEKLY`), `weekly_run_id`, and `cached_searches_used` to the run table (tracks searches served from a 28-day evidence cache as zero-credit-spend, counted separately from real API searches for an honest UI).
- Adds `selection_score` (0-100) to run_product for automatic weekly product selection.

## Design Patterns Reused (per the migration's own comments)
Same Postgres-as-state-machine pattern already proven for `thivajini_feed_*` and `mahima_stpm_*` — a Vercel Function claims one unit of work, processes it, writes the result, and returns, so a request timeout or platform retry can never lose state or double-spend a paid API call.

## Secrets Handling
No API key values are stored anywhere in this schema — only named key slots (`SERP_API_1`/`SERP_API_2`) and safe aggregate quota numbers. Consistent with AIOS security rule (never record actual key/token values).

## Files
- `reports/digital-marketing-member-pages/db/migrations/2026-08-24_006_sajeepan_lens_keywords.sql`
- `reports/digital-marketing-member-pages/db/migrations/2026-08-24_007_sajeepan_lens_keywords_full.sql`
- `reports/digital-marketing-member-pages/db/migrations/2026-08-24_008_sajeepan_lens_keywords_automation.sql`

## Files
Also (found on cross-check):
- `reports/digital-marketing-member-pages/lib/lens-keywords/*.js` (20 modules)
- `reports/digital-marketing-member-pages/pages/sajeepan/google-lens-keywords/index.html`, `lens.js`
- `reports/digital-marketing-member-pages/pages/sajeepan.html` (Requirement 5 tab integration)
- `reports/digital-marketing-member-pages/scripts/lens-keywords-migrate.js`
- `reports/digital-marketing-member-pages/tests/lens-keywords/*.test.js` (7 files)
- `reports/digital-marketing-member-pages/api/members-api.js` (references the feature)

## What Is NOT Verifiable From This Evidence
- Whether the Postgres migrations were actually run against the live database (schema presence in a `.sql` file is not proof of execution).
- Whether any real Lens/SerpAPI run has ever completed against production, or what its outcome was.
- Whether the feature has been used/reviewed by Sajeepan or Kuberan since it was built.
- The original prompt/requirement conversation (REQ-DM-2026-08-SAJE01 is referenced throughout the code but no separate requirement doc exists in this AIOS).
- Full test suite pass rate in a properly provisioned environment (this worktree lacks `node_modules`; 4/7 test files could not import past a missing `pg` dependency).

## Status
PARTIAL / SUPPORTED — code exists, is wired into the live page, and the DB-independent half of its test suite passes. Live/deployed behavior against the real database is NOT VERIFIABLE from this worktree. Do not mark full PASS.

## Reviewer
Pending — flagged for Kuberan to confirm live status.

## Next step
Ask Kuberan whether this feature has been used against production (any real run history), then update this file and the linked validation/closure with the confirmed outcome. Optionally: run `npm install` in `reports/digital-marketing-member-pages` and re-run the full test suite to get a complete pass/fail picture.
