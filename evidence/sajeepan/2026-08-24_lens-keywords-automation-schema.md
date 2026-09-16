## Purpose
Document the Sajeepan "Automation Keyword Finder" (REQ-DM-2026-08-SAJE01) database schema found in code but missing any evidence/validation/closure trail, discovered during AIOS historical recovery.

## Certainty
**SUPPORTED, not VERIFIED.** No session/conversation record for this task exists in the AIOS structure — this file is reconstructed entirely from reading the migration SQL and its inline comments. It documents what the schema says was built, not confirmed live behavior, outcomes, or user sign-off. Labeled per the recovery task's own rule: never convert UNKNOWN/SUPPORTED into VERIFIED without cross-checkable evidence.

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

## What Is NOT Verifiable From This Evidence
- Whether these migrations were actually run against the live database.
- Whether any run has ever completed, or what its outcome was.
- Whether the feature was deployed, reviewed by the user, or is still in progress.
- The original prompt/requirement conversation (REQ-DM-2026-08-SAJE01 is referenced but not found as a separate requirement doc in this AIOS).

## Status
NOT VERIFIABLE (schema-only) — do not mark PASS/FAIL. If the user confirms the run history or intended outcome, this file should be updated (not replaced) with that information.

## Reviewer
Pending — flagged for Kuberan to confirm.

## Next step
Ask Kuberan whether this feature is live, in progress, or abandoned, then update this evidence file and add matching validation/closure entries accordingly.
