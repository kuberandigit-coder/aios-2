-- 2026-08-24_007_sajeepan_lens_keywords_full.sql
--
-- REQ-DM-2026-08-SAJE01 — Automation Keyword Finder, full requirement
-- (Stages 4-12: Phase 1 keyword finder, frequency/category analysis, Phase 2
-- expansion, Keyword Planner cache, attribute validation, final title/alt
-- text, final Ads keyword output).
--
-- Target database: DILAIKSHAN_NEON_DB. Additive to migration 006 — extends
-- the same google_lens_keyword_* namespace, references google_lens_keyword_
-- run / run_product from 006. No table from 006, thivajini_feed_* or
-- mahima_stpm_* is altered or dropped.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. RUN TABLE EXTENSION — a SEPARATE analysis-phase state, deliberately not
--    merged into `status`/RUN_STATE from migration 006.
--
--    WHY: Stage 3 of the requirement is a human gate — "Use only INCLUDED
--    competitor results" (governing prompt §18) means Phase 1 keyword
--    extraction cannot correctly run until a person has reviewed at least
--    some competitors. The existing `status` column and its CREATED ->
--    PREPARING -> SEARCHING_PRODUCTS -> COMPLETED[_WITH_WARNINGS]/FAILED
--    machine (migration 006, already implemented and tested) means "the Lens
--    search phase finished" and is intentionally left untouched. A second,
--    independent state machine tracks the staff-triggered analysis pipeline
--    (Stage 4 onward) so the two phases can never be confused with each other
--    or accidentally short-circuit one another's terminal-state check.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.google_lens_keyword_run
  ADD COLUMN IF NOT EXISTS analysis_status text NULL,
  ADD COLUMN IF NOT EXISTS analysis_status_detail text NULL,
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS phase2_searches_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planner_calls_used integer NOT NULL DEFAULT 0;

-- Per-product analysis pipeline position. Fixed stage order (phase1.js
-- ANALYSIS_STAGES): phase2_google -> phase2_images -> phase2_shopping ->
-- keyword_analysis -> attribute_validation -> title_alt_build -> planner ->
-- final_output -> DONE. One (product, stage) pair is claimed per
-- advanceAnalysis() call — same FOR UPDATE SKIP LOCKED claim pattern as the
-- Lens phase, so a refresh/double-click/retry can never repeat a stage.
ALTER TABLE public.google_lens_keyword_run_product
  ADD COLUMN IF NOT EXISTS analysis_stage text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS analysis_stage_detail text NULL,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS phase1_primary_keyword text NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. PHASE 2 RESULT — Google All / Images / Shopping evidence (Stage 6)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_phase2_result (
  phase2_result_id bigserial PRIMARY KEY,
  run_product_id    uuid NOT NULL REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id            uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  engine        text NOT NULL,  -- google | google_images | google_shopping
  seed_keyword  text NULL,      -- the Phase 1 keyword this search was built from
  rank          integer NULL,
  title         text NULL,
  url           text NULL,
  displayed_domain text NULL,
  snippet       text NULL,
  image_src     text NULL,
  price         text NULL,
  rating        text NULL,
  reviews       text NULL,

  safe_provider_payload jsonb NULL,
  observed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_phase2_result_rp_idx
  ON public.google_lens_keyword_phase2_result (run_product_id, engine);
CREATE INDEX IF NOT EXISTS google_lens_keyword_phase2_result_run_idx
  ON public.google_lens_keyword_phase2_result (run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. KEYWORD — Phase 1 + Phase 2 extracted candidates, with frequency and
--    category (Stages 4-5), and brand exclusion (Stage 5 note / Stage 20).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_candidate (
  keyword_id      bigserial PRIMARY KEY,
  run_product_id   uuid NOT NULL REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id            uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  phase        text NOT NULL DEFAULT 'PHASE1',  -- PHASE1 | PHASE2
  term         text NOT NULL,
  normalized_term text NOT NULL,

  -- Product Type | Material/Finish | Style/Aesthetic | Size/Dimension |
  -- Feature/Modifier | Brand Naming Pattern | Other Relevant Search Term
  category      text NULL,

  -- distinct-competitor-title document frequency (governing prompt §18/§36 §4),
  -- never raw in-title occurrence count.
  title_frequency      integer NOT NULL DEFAULT 0,
  title_frequency_pct  numeric NULL,
  in_current_title     boolean NOT NULL DEFAULT false,
  is_brand             boolean NOT NULL DEFAULT false,
  rank                 integer NULL,  -- Top-10 ordering within its phase

  example_sources jsonb NULL,  -- [{source_name, url}], evidence not a black box
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_candidate_rp_idx
  ON public.google_lens_keyword_candidate (run_product_id, phase, rank);
CREATE INDEX IF NOT EXISTS google_lens_keyword_candidate_run_idx
  ON public.google_lens_keyword_candidate (run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. PLANNER SUGGESTION CACHE (Stage 7) — reusable across runs (governing
--    prompt §27). Status distinguishes a genuine API result from a proven
--    configuration gap; NEVER fabricated when the API is unavailable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_planner_suggestion (
  suggestion_id   bigserial PRIMARY KEY,
  run_id           uuid NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,
  run_product_id    uuid NULL REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,

  seed_keyword   text NOT NULL,
  normalized_seed text NOT NULL,
  country        text NOT NULL DEFAULT 'ca',
  language       text NOT NULL DEFAULT 'en',
  customer_context text NULL,  -- Google Ads customer id used, if any

  -- CACHED (reused stored result) | FETCHED (live API result) |
  -- BLOCKED_CONFIG_REQUIRED (no credential) | ERROR
  status          text NOT NULL,

  matched_keyword    text NULL,
  new_suggestion      text NULL,
  avg_monthly_searches integer NULL,
  competition           text NULL,
  competition_index      integer NULL,
  low_top_of_page_bid     numeric NULL,
  high_top_of_page_bid     numeric NULL,

  safe_raw       jsonb NULL,  -- never a raw OAuth/credential-bearing payload
  queried_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_planner_seed_idx
  ON public.google_lens_keyword_planner_suggestion (normalized_seed, country, language, queried_at DESC);
CREATE INDEX IF NOT EXISTS google_lens_keyword_planner_run_idx
  ON public.google_lens_keyword_planner_suggestion (run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. ATTRIBUTE VALIDATION (Stage 8) — every keyword representing a factual
--    product property, checked against the SKU's Component SOT.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_attribute_validation (
  validation_id   bigserial PRIMARY KEY,
  run_product_id   uuid NOT NULL REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id            uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,
  keyword_id         bigint NULL REFERENCES public.google_lens_keyword_candidate(keyword_id) ON DELETE SET NULL,

  term          text NOT NULL,
  attribute_type text NULL,  -- colour | finish | material | shape | size | feature | product_type | style | search_intent

  -- MATCHED_FACT | CONFLICT | UNVERIFIED_FACT | NON_FACTUAL_SEARCH_TERM | BRAND_EXCLUDED
  status        text NOT NULL,
  actual_value   text NULL,  -- the SOT value, when one exists
  reason         text NULL,

  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_attribute_validation_rp_idx
  ON public.google_lens_keyword_attribute_validation (run_product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. FINAL TITLE (Stage 9) and FINAL ALT TEXT (Stage 10) — one row per
--    product per run; staff may accept or edit before saving.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_final_title (
  final_title_id  bigserial PRIMARY KEY,
  run_product_id   uuid NOT NULL UNIQUE REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id            uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  current_title   text NULL,
  suggested_title  text NULL,
  final_title       text NULL,   -- staff-accepted/edited version
  char_count         integer NULL,
  keywords_used       jsonb NULL,

  -- SUGGESTED | NEEDS_REVIEW | SAVED
  status         text NOT NULL DEFAULT 'SUGGESTED',
  saved_by        text NULL,
  saved_at         timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_lens_keyword_final_alt_text (
  final_alt_text_id bigserial PRIMARY KEY,
  run_product_id      uuid NOT NULL UNIQUE REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id                uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  current_alt_text   text NULL,
  suggested_alt_text  text NULL,
  final_alt_text        text NULL,
  keywords_used           jsonb NULL,

  status         text NOT NULL DEFAULT 'SUGGESTED',
  saved_by        text NULL,
  saved_at         timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. FINAL ADS KEYWORD OUTPUT (Stage 11) — deduplicated, provenance-tagged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_final_ads_keyword (
  final_ads_keyword_id bigserial PRIMARY KEY,
  run_product_id          uuid NOT NULL REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id                    uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  keyword        text NOT NULL,
  normalized_keyword text NOT NULL,

  -- PHASE1 | PHASE2 | PLANNER | TITLE — a keyword can carry more than one
  -- source, so this is the PRIMARY source; full provenance lives in the jsonb
  -- columns below.
  source         text NOT NULL,
  phase1_frequency integer NULL,
  phase2_source     text NULL,
  planner_metrics    jsonb NULL,
  existing_ads_evidence jsonb NULL,  -- google_ads.keywords / keyword_performance matches
  attribute_status     text NULL,

  -- INCLUDED | EXCLUDED
  final_status   text NOT NULL DEFAULT 'INCLUDED',
  exclusion_reason text NULL,

  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (run_product_id, normalized_keyword)
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_final_ads_keyword_rp_idx
  ON public.google_lens_keyword_final_ads_keyword (run_product_id);

COMMIT;
