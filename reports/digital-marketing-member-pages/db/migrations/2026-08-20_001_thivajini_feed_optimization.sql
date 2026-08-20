-- =====================================================================
-- Migration : 2026-08-20_001_thivajini_feed_optimization
-- Project   : DM-2026-08-THIV01 — Ledsone.fr Feed Optimization (Thivajini)
-- Target DB : APPLICATION-OWNED Neon Postgres
--             (FEED_TRACKER_DB_URL || AUTH_DATABASE_URL)
--             *** NOT the Ledsone operational database ***
--
-- WHY THIS FILE EXISTS
--   The dashboard's existing habit is `CREATE TABLE IF NOT EXISTS` inside a
--   request handler (api/members-api.js:1612, api/requirement.js:5960).
--   ARCHITECTURE.md §10 finding 6 records that as a defect: it mixes schema
--   migration with request processing and forces the runtime role to hold DDL
--   rights. This feature deliberately does NOT do that. Nothing in
--   lib/feed/** issues DDL at runtime.
--
-- SAFETY
--   * Additive only. No DROP, no ALTER of any existing object, no TRUNCATE.
--   * Every object is namespaced `thivajini_feed_*` so it cannot collide with
--     `users`, `staff_order_attribution`, `jefri_req6_tracker`,
--     `hetheesha_fix_tracker`, `hetheesha_fix_tracker_r2` or
--     `feed_optimization_tracker`.
--   * `public.feed_optimization_tracker` is Sajeepan's UK ad-waste tracker
--     (wrong owner, wrong grain — discovery §D.3/§E-1). It is NOT touched,
--     read, altered or extended by this migration.
--   * Re-runnable: every statement is IF NOT EXISTS.
--
-- PRE-APPLY CHECKS (run these first — see validation asset §Neon):
--   SELECT current_database(), current_user;
--   SELECT to_regclass('public.users') IS NOT NULL AS looks_like_app_db;
--   SELECT tablename FROM pg_tables
--    WHERE schemaname='public' AND tablename LIKE 'thivajini_feed%';  -- expect 0 rows
--
-- APPLY:
--   psql "$FEED_TRACKER_DB_URL" -v ON_ERROR_STOP=1 \
--     -f db/migrations/2026-08-20_001_thivajini_feed_optimization.sql
-- =====================================================================

BEGIN;

-- gen_random_uuid() ships with PostgreSQL 13+ core; pgcrypto is the fallback
-- for older servers. Harmless when already present.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- A. BATCH — one row per optimization batch
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_batch (
  batch_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id    text        NOT NULL DEFAULT 'REQ-DM-2026-08-THIV01',
  end_user          text        NOT NULL DEFAULT 'Thivajini',
  team              text        NOT NULL DEFAULT 'Digital Marketing',
  batch_status      text        NOT NULL DEFAULT 'DRAFT',
  -- Immutable record of how stale the operational inputs were when the batch
  -- opened. Discovery Addendum B §BC.1: FR paid search terms stop at
  -- 2026-06-30 (pmax) / 2026-07-06 (conventional) while the tables are
  -- globally current. These columns keep that fact attached to the batch.
  ads_perf_cutoff           date,
  pmax_terms_cutoff         date,
  conventional_terms_cutoff date,
  shopify_orders_cutoff     date,
  gsc_cutoff                date,
  source_cutoffs    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  notes             text,
  created_by        text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_batch_status_chk
    CHECK (batch_status IN ('DRAFT','IN_REVIEW','COMPLETE','ABANDONED'))
);

COMMENT ON TABLE public.thivajini_feed_batch IS
  'DM-2026-08-THIV01. One optimization batch for Ledsone.fr feed copy. Application-owned; never an operational product source.';
COMMENT ON COLUMN public.thivajini_feed_batch.pmax_terms_cutoff IS
  'MAX(date) of google_ads.pmax_campaign_search_term_data for the FR account when the batch opened. Preserves search-term staleness as evidence.';

-- ---------------------------------------------------------------------
-- B. TERM SELECTION — staff decision, application-owned
--    `Include in Prompt` does NOT exist in Ledsone DB (Addendum B, item 28).
--    It is a staff judgement and is stored here, never written back to
--    Ledsone.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_term_selection (
  term_selection_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          uuid        NOT NULL REFERENCES public.thivajini_feed_batch(batch_id) ON DELETE CASCADE,
  item_id           text,                       -- NULL = batch-wide selection
  search_term       text        NOT NULL,
  category_label    text,                       -- google_ads.campaign_search_term_insights.category_label
  campaign_id       text,
  source_table      text        NOT NULL,       -- 'pmax_campaign_search_term_data' | 'campaign_search_term_data'
  source_min_date   date,
  source_max_date   date,
  freshness_status  text        NOT NULL DEFAULT 'STALE',
  -- Addendum B item 25/26: exact search-term -> product attribution does NOT
  -- exist. Never store CONFIRMED here from Ledsone evidence alone.
  mapping_level     text        NOT NULL DEFAULT 'CAMPAIGN',
  mapping_confidence text       NOT NULL DEFAULT 'LOW',
  metrics_snapshot  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_selected       boolean     NOT NULL DEFAULT true,
  selected_by       text        NOT NULL,
  selected_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_term_sel_freshness_chk
    CHECK (freshness_status IN ('FRESH','STALE','UNKNOWN')),
  CONSTRAINT thivajini_feed_term_sel_mapping_chk
    CHECK (mapping_level IN ('CAMPAIGN','SEARCH_CATEGORY','PRODUCT_TYPE','EXACT_PRODUCT')),
  CONSTRAINT thivajini_feed_term_sel_conf_chk
    CHECK (mapping_confidence IN ('LOW','MEDIUM','HIGH'))
);

CREATE UNIQUE INDEX IF NOT EXISTS thivajini_feed_term_sel_uq
  ON public.thivajini_feed_term_selection (batch_id, COALESCE(item_id,''), search_term, source_table);
CREATE INDEX IF NOT EXISTS thivajini_feed_term_sel_batch_idx
  ON public.thivajini_feed_term_selection (batch_id, item_id);

COMMENT ON COLUMN public.thivajini_feed_term_selection.mapping_level IS
  'How strongly this term is tied to the product. Ledsone DB supports CAMPAIGN and SEARCH_CATEGORY only. EXACT_PRODUCT is unreachable from Ledsone DB (Addendum B item 25) and must never be set from DB evidence alone.';

-- ---------------------------------------------------------------------
-- C. GENERATION RUN — one row per product per generation round
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_generation (
  generation_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid        NOT NULL REFERENCES public.thivajini_feed_batch(batch_id) ON DELETE CASCADE,
  item_id            text        NOT NULL,      -- google_ads.product_performance.product_item_id
  shopify_product_id text,
  shopify_variant_id text,
  sku                text,
  iteration_no       integer     NOT NULL DEFAULT 1,
  -- Immutable evidence. Makes a historical generation reproducible even after
  -- google_ads.merchant_products (which has NO date column — Addendum B §BJ)
  -- changes underneath us. This is the ONLY reason operational values are
  -- copied into Neon: as a frozen snapshot, never as a queryable source.
  input_snapshot     jsonb       NOT NULL,
  missing_evidence   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  selected_terms_snapshot jsonb  NOT NULL DEFAULT '[]'::jsonb,
  organic_support_snapshot jsonb,               -- GSC; NULL when not supplied
  feed_eligible_status text      NOT NULL DEFAULT 'UNKNOWN',
  feed_eligible_source text      NOT NULL DEFAULT 'NOT_AVAILABLE_IN_LEDSONE_DB',
  prompt_version     text        NOT NULL,
  prompt_hash        text        NOT NULL,
  template_version   text        NOT NULL,
  generation_status  text        NOT NULL DEFAULT 'PENDING',
  evidence_confidence text,                     -- HIGH | MEDIUM | LOW
  evidence_confidence_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_attempt_id uuid,                     -- FK added after attempt table
  is_draft_only      boolean     NOT NULL DEFAULT true,
  created_by         text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  CONSTRAINT thivajini_feed_gen_status_chk
    CHECK (generation_status IN ('PENDING','RUNNING','SUCCESS','FAILED','REJECTED','QUOTA_EXHAUSTED')),
  CONSTRAINT thivajini_feed_gen_eligible_chk
    CHECK (feed_eligible_status IN ('UNKNOWN','Y','N','CHECK')),
  CONSTRAINT thivajini_feed_gen_conf_chk
    CHECK (evidence_confidence IS NULL OR evidence_confidence IN ('HIGH','MEDIUM','LOW'))
);

CREATE INDEX IF NOT EXISTS thivajini_feed_gen_batch_idx ON public.thivajini_feed_generation (batch_id);
CREATE INDEX IF NOT EXISTS thivajini_feed_gen_item_idx  ON public.thivajini_feed_generation (item_id, iteration_no DESC);

COMMENT ON COLUMN public.thivajini_feed_generation.feed_eligible_status IS
  'Ledsone DB has NO France Merchant eligibility source (Addendum B §BH: ad_group_products has 0 FR rows and is ad-group scoped, so PMax products can never appear). UNKNOWN is the honest default and must never be silently promoted to Y.';
COMMENT ON COLUMN public.thivajini_feed_generation.is_draft_only IS
  'TRUE whenever feed_eligible_status <> Y. Draft generation is permitted for review; production push is blocked.';

-- ---------------------------------------------------------------------
-- D. LLM ATTEMPT — one row for EVERY provider attempt, including failures
--    Nothing here may ever contain an API key, an Authorization header, or
--    any secret-bearing request header. Providers are identified by ALIAS
--    (`local_primary`, `gemini_key_1`, `gemini_key_2`) only.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_llm_attempt (
  attempt_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id       uuid        NOT NULL REFERENCES public.thivajini_feed_generation(generation_id) ON DELETE CASCADE,
  attempt_seq         integer     NOT NULL,
  provider            text        NOT NULL,     -- 'local' | 'gemini'
  provider_alias      text        NOT NULL,     -- 'local_primary' | 'gemini_key_1' | 'gemini_key_2'
  model               text,
  model_version       text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  latency_ms          integer,
  status              text        NOT NULL,
  fallback_reason     text,
  http_status         integer,
  http_status_class   text,
  provider_request_id text,
  -- Token accounting
  input_tokens        integer,
  output_tokens       integer,
  total_tokens        integer,
  cached_tokens       integer,
  thinking_tokens     integer,
  token_count_method  text,                     -- ACTUAL | ESTIMATED
  context_input_limit integer,
  output_token_limit  integer,
  context_utilization_pct numeric(6,2),
  context_limit_source text,                    -- API | MANUAL | OBSERVED | UNKNOWN
  omitted_context     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Quota: configured vs observed vs provider-reported. Never invented.
  configured_rpm      integer,
  configured_tpm      integer,
  configured_rpd      integer,
  quota_limit_source  text        NOT NULL DEFAULT 'UNKNOWN',
  observed_requests_minute integer,
  observed_input_tokens_minute integer,
  observed_requests_day    integer,
  retry_after_seconds integer,
  quota_error_type    text,
  raw_response        jsonb,
  parsed_response     jsonb,
  validation_result   jsonb,
  response_evidence_confidence text,
  safety_block_reason text,
  vision_used         boolean     NOT NULL DEFAULT false,
  vision_skip_reason  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_attempt_status_chk
    CHECK (status IN ('SUCCESS','VALIDATION_FAILED','PARSE_FAILED','TIMEOUT','CONNECTION_FAILED',
                      'AUTH_FAILED','PROVIDER_5XX','RATE_LIMITED','QUOTA_EXHAUSTED','SAFETY_BLOCKED',
                      'CONTEXT_EXCEEDED','NOT_CONFIGURED','ERROR')),
  CONSTRAINT thivajini_feed_attempt_tokenmethod_chk
    CHECK (token_count_method IS NULL OR token_count_method IN ('ACTUAL','ESTIMATED')),
  CONSTRAINT thivajini_feed_attempt_quotasrc_chk
    CHECK (quota_limit_source IN ('API','MANUAL','OBSERVED','UNKNOWN')),
  CONSTRAINT thivajini_feed_attempt_ctxsrc_chk
    CHECK (context_limit_source IS NULL OR context_limit_source IN ('API','MANUAL','OBSERVED','UNKNOWN')),
  CONSTRAINT thivajini_feed_attempt_seq_uq UNIQUE (generation_id, attempt_seq)
);

CREATE INDEX IF NOT EXISTS thivajini_feed_attempt_gen_idx
  ON public.thivajini_feed_llm_attempt (generation_id, attempt_seq);
CREATE INDEX IF NOT EXISTS thivajini_feed_attempt_alias_time_idx
  ON public.thivajini_feed_llm_attempt (provider_alias, started_at DESC);

COMMENT ON TABLE public.thivajini_feed_llm_attempt IS
  'Every LLM attempt, success or failure. NEVER stores API keys, Authorization headers or any secret-bearing header. Providers identified by alias only.';
COMMENT ON COLUMN public.thivajini_feed_llm_attempt.configured_rpm IS
  'Only ever populated from provider/account/manual configuration. NULL + quota_limit_source=UNKNOWN when the real ceiling is not known. Never guessed.';
COMMENT ON COLUMN public.thivajini_feed_llm_attempt.observed_requests_minute IS
  'APPLICATION OBSERVED USAGE ONLY. Does not represent all usage of the Google Cloud project outside this application.';

-- deferred FK: a generation points at its winning attempt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'thivajini_feed_gen_selected_attempt_fk'
  ) THEN
    ALTER TABLE public.thivajini_feed_generation
      ADD CONSTRAINT thivajini_feed_gen_selected_attempt_fk
      FOREIGN KEY (selected_attempt_id)
      REFERENCES public.thivajini_feed_llm_attempt(attempt_id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- E. VARIANTS — one row per A/B variant
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_variant (
  variant_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id     uuid        NOT NULL REFERENCES public.thivajini_feed_generation(generation_id) ON DELETE CASCADE,
  attempt_id        uuid        REFERENCES public.thivajini_feed_llm_attempt(attempt_id) ON DELETE SET NULL,
  variant_label     text        NOT NULL,       -- 'A' | 'B'
  title_fr          text        NOT NULL,
  title_char_count  integer     NOT NULL,
  description_fr    text        NOT NULL,
  suggested_gpc     text,
  converting_terms_used jsonb   NOT NULL DEFAULT '[]'::jsonb,
  uncertain_claims  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  validation_status text        NOT NULL,       -- PASS | FAIL
  validation_details jsonb      NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_variant_label_chk CHECK (variant_label IN ('A','B')),
  CONSTRAINT thivajini_feed_variant_valid_chk CHECK (validation_status IN ('PASS','FAIL')),
  -- requirement §3.3: title strictly under 150 characters
  CONSTRAINT thivajini_feed_variant_title_len_chk CHECK (title_char_count < 150),
  CONSTRAINT thivajini_feed_variant_uq UNIQUE (generation_id, attempt_id, variant_label)
);

CREATE INDEX IF NOT EXISTS thivajini_feed_variant_gen_idx
  ON public.thivajini_feed_variant (generation_id, variant_label);

-- ---------------------------------------------------------------------
-- F. SELECTION / ITERATION HISTORY — append-only, never overwritten
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_selection (
  selection_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id     uuid        NOT NULL REFERENCES public.thivajini_feed_generation(generation_id) ON DELETE CASCADE,
  item_id           text        NOT NULL,
  iteration_no      integer     NOT NULL,
  selected_variant_id uuid      REFERENCES public.thivajini_feed_variant(variant_id) ON DELETE SET NULL,
  selected_variant_label text,
  change_made       text,
  reason            text,
  result_summary    text,
  reviewer          text,
  review_status     text        NOT NULL DEFAULT 'PENDING',
  next_action       text,
  -- Push stays blocked in this deliverable. Discovery §M: the written
  -- requirement never defines a push target. This column records staff intent
  -- in Neon only; it performs nothing.
  push_state        text        NOT NULL DEFAULT 'NOT_READY',
  push_blocked_reason text,
  test_start_date   date,
  selected_by       text        NOT NULL,
  selected_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_sel_review_chk
    CHECK (review_status IN ('PENDING','APPROVED','REJECTED','NEEDS_CHANGES')),
  CONSTRAINT thivajini_feed_sel_push_chk
    CHECK (push_state IN ('NOT_READY','READY_FOR_PUSH','BLOCKED','PUSHED'))
);

CREATE INDEX IF NOT EXISTS thivajini_feed_sel_item_idx
  ON public.thivajini_feed_selection (item_id, iteration_no DESC, selected_at DESC);

COMMENT ON TABLE public.thivajini_feed_selection IS
  'Append-only iteration log. A new decision inserts a new row; previous rows are never updated or deleted.';
COMMENT ON COLUMN public.thivajini_feed_selection.push_state IS
  'Staff intent recorded in Neon only. No production push is implemented. PUSHED is reserved and unreachable until a push target is approved.';

-- ---------------------------------------------------------------------
-- G. PERFORMANCE SNAPSHOTS — immutable BASELINE / POST_CHANGE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_perf_snapshot (
  snapshot_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id     uuid        REFERENCES public.thivajini_feed_generation(generation_id) ON DELETE SET NULL,
  selection_id      uuid        REFERENCES public.thivajini_feed_selection(selection_id) ON DELETE SET NULL,
  item_id           text        NOT NULL,
  iteration_no      integer,
  snapshot_type     text        NOT NULL,       -- BASELINE | POST_CHANGE
  period_start      date        NOT NULL,
  period_end        date        NOT NULL,
  impressions       bigint,
  clicks            bigint,
  ctr               numeric(10,6),
  gads_conversions  numeric(14,4),
  conversion_value  numeric(14,2),
  conversion_rate   numeric(10,6),
  shopify_conv_orders    integer,
  shopify_conv_lines     integer,
  shopify_conv_units     numeric(14,2),
  shopify_conv_grain_note text,
  source_max_date   date,
  source_refs       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  captured_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_perf_type_chk CHECK (snapshot_type IN ('BASELINE','POST_CHANGE'))
);

CREATE INDEX IF NOT EXISTS thivajini_feed_perf_item_idx
  ON public.thivajini_feed_perf_snapshot (item_id, snapshot_type, period_start);

COMMENT ON COLUMN public.thivajini_feed_perf_snapshot.shopify_conv_grain_note IS
  'Addendum B §BM: orders / lines / units diverge ~2.4x (81 / 111 / 197 over 30d). All three are stored; the business has not yet chosen the definition.';

-- ---------------------------------------------------------------------
-- H. PROVIDER / MODEL CAPABILITY SNAPSHOT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_provider_model (
  provider_model_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text        NOT NULL,
  provider_alias    text,
  model             text        NOT NULL,
  display_name      text,
  model_version     text,
  supports_text     boolean,
  supports_vision   boolean,
  supports_structured_json boolean,
  input_context_limit integer,
  output_token_limit  integer,
  known_rpm         integer,
  known_tpm         integer,
  known_rpd         integer,
  quota_basis       text,                       -- e.g. 'PROJECT' | 'KEY' | 'UNKNOWN'
  limit_source      text        NOT NULL DEFAULT 'UNKNOWN',
  raw_metadata      jsonb,
  discovered_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_pm_limitsrc_chk
    CHECK (limit_source IN ('API','MANUAL','OBSERVED','UNKNOWN'))
);

CREATE INDEX IF NOT EXISTS thivajini_feed_pm_idx
  ON public.thivajini_feed_provider_model (provider, model, discovered_at DESC);

COMMENT ON COLUMN public.thivajini_feed_provider_model.quota_basis IS
  'Gemini quota is commonly PROJECT-level, so two API keys in one project do NOT double the quota. Left UNKNOWN until the account confirms it.';
COMMENT ON COLUMN public.thivajini_feed_provider_model.known_rpm IS
  'NULL unless the real ceiling came from the provider API or explicit human confirmation. Never guessed from documentation.';

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, destructive — run only on an explicit decision)
--   BEGIN;
--   DROP TABLE IF EXISTS public.thivajini_feed_provider_model;
--   DROP TABLE IF EXISTS public.thivajini_feed_perf_snapshot;
--   DROP TABLE IF EXISTS public.thivajini_feed_selection;
--   DROP TABLE IF EXISTS public.thivajini_feed_variant;
--   DROP TABLE IF EXISTS public.thivajini_feed_llm_attempt;
--   DROP TABLE IF EXISTS public.thivajini_feed_generation;
--   DROP TABLE IF EXISTS public.thivajini_feed_term_selection;
--   DROP TABLE IF EXISTS public.thivajini_feed_batch;
--   COMMIT;
-- =====================================================================
