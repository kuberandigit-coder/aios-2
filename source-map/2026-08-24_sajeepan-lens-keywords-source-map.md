## Sajeepan Requirement 5 (Automation Keyword Finder) — Source Map

| Concern | File | Notes |
|---|---|---|
| Backend router | `lib/lens-keywords/router.js` | dispatches phase1/analysis/automation/weekly requests |
| Phase 1 (Lens search) | `lib/lens-keywords/phase1.js`, `serpapi.js` | calls SerpAPI Google Lens engine |
| Provider quota | `lib/lens-keywords/quota.js` | SerpAPI Account API — safe aggregate numbers only |
| Cache | `lib/lens-keywords/cache.js` | 28-day evidence cache, zero-credit-spend reuse |
| Competitor filtering / review | `lib/lens-keywords/competitor-filter.js`, `review.js` | human review gate — NEEDS_REVIEW default |
| Analysis (frequency/category) | `lib/lens-keywords/analysis.js` | Stage 4+ of the requirement |
| Keyword Planner integration | `lib/lens-keywords/keyword-planner.js` | cached Keyword Planner data |
| Google Ads integration | `lib/lens-keywords/google-ads.js` | final Ads keyword output |
| AI/attribute generation | `lib/lens-keywords/gemma.js`, `attributes.js`, `title.js`, `alt-text.js`, `final-output.js` | title/alt-text/attribute validation and final output |
| Weekly automation | `lib/lens-keywords/weekly.js`, `automation.js`, `eligibility.js` | fully automatic 50-product weekly batch |
| Export | `lib/lens-keywords/export.js` | output export |
| Config / DB access | `lib/lens-keywords/config.js`, `sql.js`, `repo.js` | `pg` client, targets `DILAIKSHAN_NEON_DB` only |
| Error handling | `lib/lens-keywords/errors.js` | user-safe error surfacing |
| Frontend UI | `pages/sajeepan/google-lens-keywords/index.html`, `lens.js` | Requirement 5 tab content |
| Mount point | `pages/sajeepan.html` (tab `req5`/`req5Panel`) | injected into existing sajeepan dashboard, Req1-4 untouched |
| DB schema | `db/migrations/2026-08-24_006/007/008_sajeepan_lens_keywords*.sql` | `google_lens_keyword_*` table namespace |
| Migration runner | `scripts/lens-keywords-migrate.js` | dedicated runner, separate from `stpm-migrate.js` |
| Tests | `tests/lens-keywords/*.test.js` (7 files) | logic, phase1, serpapi, security, ui, analysis-logic, automation |
| External API | SerpAPI (`serpapi.com`, Google Lens engine) | key via `SERP_API_1`/`SERP_API_2` env slots, never stored/logged |
| Target database | `DILAIKSHAN_NEON_DB` env var | explicitly never the Ledsone operational DB or other app DB URLs |

## Verification status
Code paths above confirmed to exist via direct file read and `grep` cross-check
(2026-09-16 recovery pass). Live/production data flow through these paths is
NOT VERIFIED — no run-history record exists in this AIOS.
