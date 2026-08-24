-- 2026-08-24_008_sajeepan_lens_keywords_automation.sql
--
-- REQ-DM-2026-08-SAJE01 — Fully automatic weekly 50-product workflow.
-- Additive to migrations 006/007. Extends the same google_lens_keyword_*
-- namespace. No table from a prior migration, thivajini_feed_* or
-- mahima_stpm_* is altered destructively or dropped.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. RUN TABLE — batch type + weekly linkage
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.google_lens_keyword_run
  ADD COLUMN IF NOT EXISTS batch_type text NOT NULL DEFAULT 'MANUAL',  -- MANUAL | WEEKLY
  ADD COLUMN IF NOT EXISTS weekly_run_id uuid NULL,
  -- searches served from the 28-day evidence cache: real work done, zero
  -- external credit spent. Counted separately from searches_used so the UI can
  -- state both honestly.
  ADD COLUMN IF NOT EXISTS cached_searches_used integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. RUN PRODUCT — automatic selection evidence
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.google_lens_keyword_run_product
  ADD COLUMN IF NOT EXISTS selection_score integer NULL,       -- 0-100, §8 weights
  ADD COLUMN IF NOT EXISTS selection_reason text NULL,
  ADD COLUMN IF NOT EXISTS auto_selected boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. COMPETITOR RESULT — deterministic auto-decision, kept alongside (never
--    replacing) the existing human-override review table. A result's
--    auto_decision is written at persistence time; the SAME row also gets an
--    automatic review row (reviewed_by='SYSTEM_AUTO') so the existing
--    "use only INCLUDED results" downstream logic (Stage 4) needs no change,
--    and a human can still optionally override later without being required to.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.google_lens_keyword_competitor_result
  ADD COLUMN IF NOT EXISTS auto_decision text NULL,      -- AUTO_INCLUDED | AUTO_EXCLUDED_SELF | ..._DUPLICATE | ..._MISSING_DATA | ..._IRRELEVANT | ..._ATTRIBUTE_CONFLICT
  ADD COLUMN IF NOT EXISTS auto_score numeric NULL,       -- 0-100 relevance score, §15
  ADD COLUMN IF NOT EXISTS decision_reasons jsonb NULL;    -- ["High Lens rank + matching product-type phrase", ...]

-- ─────────────────────────────────────────────────────────────────────────────
-- D. SEARCH EVIDENCE CACHE — fingerprint-keyed, 28-day default TTL (§24).
--    Checked BEFORE every SerpAPI call; a fresh hit means zero external spend.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_search_cache (
  cache_id       bigserial PRIMARY KEY,
  fingerprint    text NOT NULL UNIQUE,   -- sha256 of the normalized fingerprint inputs
  engine         text NOT NULL,          -- google_lens | google | google_images | google_shopping
  cache_key_desc text NULL,              -- human-readable description of what was fingerprinted (never a secret)
  results        jsonb NOT NULL,         -- normalized results array, same shape as the live path produces
  key_slot       text NULL,              -- which slot originally fetched this (name only)
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  hit_count      integer NOT NULL DEFAULT 0,
  last_hit_at    timestamptz NULL
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_search_cache_engine_idx
  ON public.google_lens_keyword_search_cache (engine, fetched_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. WEEKLY RUN — one row per ISO week, idempotent (§51).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_weekly_run (
  weekly_run_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_week          text NOT NULL UNIQUE,   -- e.g. 'SAJEEPAN-WEEKLY-2026-W35'
  run_id            uuid NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE SET NULL,

  -- CREATED | SELECTING_PRODUCTS | RUNNING | COMPLETED | COMPLETED_WITH_WARNINGS | FAILED
  status            text NOT NULL DEFAULT 'CREATED',
  status_detail     text NULL,
  error_message     text NULL,
  triggered_by      text NULL,   -- 'cron' | 'cron-continuation' | staff username for a manual trigger

  products_eligible integer NOT NULL DEFAULT 0,
  products_selected  integer NOT NULL DEFAULT 0,
  products_excluded   integer NOT NULL DEFAULT 0,

  fresh_searches_used   integer NOT NULL DEFAULT 0,
  cached_searches_used    integer NOT NULL DEFAULT 0,
  gemma_generations         integer NOT NULL DEFAULT 0,
  script_fallback_generations integer NOT NULL DEFAULT 0,

  started_at        timestamptz NULL,
  completed_at       timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_weekly_run_created_idx
  ON public.google_lens_keyword_weekly_run (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. GENERATION EVIDENCE — Gemma / script-fallback title+alt-text (§41).
--    Never persists an API key.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_generation (
  generation_id     bigserial PRIMARY KEY,
  run_product_id     uuid NOT NULL REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id              uuid NOT NULL REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  -- GEMMA_4_31B | GEMMA_4_26B | SCRIPT_FALLBACK
  generation_source  text NOT NULL,
  model_name          text NULL,
  prompt_version        text NULL,
  input_hash             text NULL,

  -- PASSED               model answered and passed deterministic validation
  -- TITLE_SAFE_FALLBACK  model answered but failed validation twice
  -- SCRIPT_FALLBACK      no model reachable / provider error — script builder used
  validation_status   text NOT NULL,
  validation_failures    jsonb NULL,

  title                 text NULL,
  alt_text                text NULL,
  character_count           integer NULL,
  rationale                  text NULL,

  generated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_lens_keyword_generation_rp_idx
  ON public.google_lens_keyword_generation (run_product_id, generated_at DESC);

COMMIT;
