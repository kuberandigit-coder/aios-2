-- 2026-08-24_006_sajeepan_lens_keywords.sql
--
-- REQ-DM-2026-08-SAJE01 — Automation Keyword Finder, Phase 1
-- (Same SKU -> Google Lens visual search -> competitor result capture -> review).
--
-- Target database: the APPLICATION Neon DB reached through DILAIKSHAN_NEON_DB.
-- NEVER the Ledsone operational DB. NEVER AUTH_DATABASE_URL / NEON_DATABASE_URL /
-- FEED_TRACKER_DB_URL / DATABASE_URL. This mirrors the boundary already proven
-- for mahima_stpm_* (same DILAIKSHAN_NEON_DB, different table prefix) and
-- thivajini_feed_* (AUTH_DATABASE_URL — a different app DB, not reused here).
--
-- WHY THESE TABLES EXIST
--   A Vercel Function cannot hold a 15-product Lens run in memory or in one
--   synchronous request: it would either time out or burn 15 SerpAPI credits
--   in an unrecoverable burst on any retry. The run therefore lives in Postgres
--   as a state machine (same pattern as thivajini_feed_cycle / mahima_stpm_run):
--   advanceRun() claims ONE product, does ONE Lens search, writes the result,
--   and returns. A refresh, a double click or a platform retry all converge on
--   the same rows and never repeat a search that already ran.
--
-- ADDITIVE AND RE-RUNNABLE. IF NOT EXISTS throughout. No DROP. No TRUNCATE.
-- Nothing outside the google_lens_keyword_* namespace is referenced or altered.
-- No SerpAPI key value is ever stored by any table here — see google_lens_
-- keyword_provider_attempt.key_slot (slot name only) and _quota_snapshot
-- (aggregate usage numbers only, never api_key/account_email/account_id).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. RUN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_run (
  run_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_no              bigserial   NOT NULL,
  created_by          text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz NULL,
  completed_at        timestamptz NULL,

  -- CREATED | PREPARING | SEARCHING_PRODUCTS | BUILDING_RESULTS
  -- COMPLETED | COMPLETED_WITH_WARNINGS | FAILED
  status              text        NOT NULL DEFAULT 'CREATED',
  status_detail       text        NULL,

  provider            text        NOT NULL DEFAULT 'SERPAPI',
  country             text        NOT NULL DEFAULT 'ca',   -- Canada, per the requirement
  language            text        NOT NULL DEFAULT 'en',

  requested_product_count integer NOT NULL DEFAULT 0,
  products_total           integer NOT NULL DEFAULT 0,
  products_done             integer NOT NULL DEFAULT 0,
  products_success           integer NOT NULL DEFAULT 0,
  products_no_match           integer NOT NULL DEFAULT 0,
  products_failed              integer NOT NULL DEFAULT 0,
  products_skipped_missing_image integer NOT NULL DEFAULT 0,

  competitor_result_count integer NOT NULL DEFAULT 0,
  searches_estimated       integer NOT NULL DEFAULT 0,
  searches_used              integer NOT NULL DEFAULT 0,

  -- IDEMPOTENCY. A double click, a browser refresh or a Vercel retry all send
  -- the same key, so only the first one creates a run and spends credits.
  idempotency_key     text        NULL,

  error_message        text       NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS google_lens_keyword_run_idem_uq
  ON public.google_lens_keyword_run (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS google_lens_keyword_run_created_idx
  ON public.google_lens_keyword_run (created_at DESC);
CREATE INDEX IF NOT EXISTS google_lens_keyword_run_status_idx
  ON public.google_lens_keyword_run (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. RUN PRODUCT — immutable evidence snapshot + per-product state.
--    One product failing must never destroy the run.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_run_product (
  run_product_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid        NOT NULL
                    REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,
  seq             integer     NOT NULL,

  -- Same-SKU identity, snapshotted at run creation. This is NOT the source of
  -- truth for tomorrow's current product title — Ledsone (listings.shopify_
  -- listings) remains that. This is what THIS run actually searched against.
  sku                     text  NOT NULL,
  mapped_sku              text  NULL,
  product_item_id         text  NULL,
  product_title_snapshot  text  NULL,
  product_url_snapshot    text  NULL,
  image_url_snapshot      text  NULL,
  product_type_snapshot   text  NULL,
  attribute_snapshot      jsonb NULL,
  source_identity         jsonb NULL,  -- which Ledsone table/join resolved this row

  -- WAITING | RUNNING | SUCCESS | NO_VISUAL_MATCHES | MISSING_IMAGE | FAILED
  state           text        NOT NULL DEFAULT 'WAITING',

  provider            text    NULL,
  provider_search_id  text    NULL,
  result_count        integer NOT NULL DEFAULT 0,

  error_code           text   NULL,
  error_detail_safe    text   NULL,   -- staff-safe text only, never a raw stack

  started_at      timestamptz NULL,
  completed_at    timestamptz NULL,

  UNIQUE (run_id, sku)
);

CREATE INDEX IF NOT EXISTS google_lens_keyword_run_product_run_idx
  ON public.google_lens_keyword_run_product (run_id, seq);
CREATE INDEX IF NOT EXISTS google_lens_keyword_run_product_state_idx
  ON public.google_lens_keyword_run_product (run_id, state);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. COMPETITOR RESULT — normalized evidence. NEVER fabricated DOM fields.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_competitor_result (
  competitor_result_id bigserial PRIMARY KEY,
  run_product_id  uuid        NOT NULL
                    REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id          uuid        NOT NULL
                    REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  rank            integer     NULL,
  provider        text        NOT NULL DEFAULT 'SERPAPI',
  result_type     text        NOT NULL DEFAULT 'visual_matches',

  -- The requirement's exact field list. Populated ONLY when the provider
  -- genuinely returned an equivalent — otherwise NULL, never a fabricated
  -- substitute (e.g. title copied into image_alt).
  image_src        text NULL,
  image_alt         text NULL,
  url                text NULL,
  h3_heading         text NULL,
  cite                text NULL,
  emphasized_text      text NULL,
  aria_label            text NULL,
  displayed_domain       text NULL,
  title                   text NULL,
  source_name              text NULL,

  is_self_result  boolean     NOT NULL DEFAULT false,
  is_duplicate    boolean     NOT NULL DEFAULT false,
  duplicate_of_id bigint      NULL,

  -- Whitelisted provider evidence only — never the raw SerpAPI response
  -- (which can carry request-identifying metadata). See lib/lens-keywords/
  -- normalize.js SAFE_RESULT_FIELDS for the exact allowlist.
  safe_provider_payload jsonb NULL,

  observed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_lens_keyword_competitor_result_rp_idx
  ON public.google_lens_keyword_competitor_result (run_product_id, rank);
CREATE INDEX IF NOT EXISTS google_lens_keyword_competitor_result_run_idx
  ON public.google_lens_keyword_competitor_result (run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. PROVIDER ATTEMPT — safe telemetry only. NEVER an api_key value.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_provider_attempt (
  attempt_id      bigserial   PRIMARY KEY,
  run_product_id  uuid        NOT NULL
                    REFERENCES public.google_lens_keyword_run_product(run_product_id) ON DELETE CASCADE,
  run_id          uuid        NOT NULL
                    REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  provider        text        NOT NULL DEFAULT 'SERPAPI',
  key_slot        text        NULL,   -- 'SERP_API_1' | 'SERP_API_2' — slot NAME only
  engine          text        NOT NULL DEFAULT 'google_lens',
  search_id       text        NULL,   -- SerpAPI search_metadata.id — not sensitive

  -- SUCCESS | NO_VISUAL_MATCHES | RATE_LIMITED | QUOTA_EXHAUSTED | TIMEOUT
  -- INVALID_PARAMS | CONNECTION_FAILED | ERROR | NOT_CONFIGURED
  status          text        NOT NULL,
  http_status     integer     NULL,
  latency_ms      integer     NULL,

  remaining_credits_before integer NULL,
  remaining_credits_after  integer NULL,

  error_code        text      NULL,
  error_detail_safe   text    NULL,

  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz NULL
);

CREATE INDEX IF NOT EXISTS google_lens_keyword_provider_attempt_rp_idx
  ON public.google_lens_keyword_provider_attempt (run_product_id);
CREATE INDEX IF NOT EXISTS google_lens_keyword_provider_attempt_run_idx
  ON public.google_lens_keyword_provider_attempt (run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. QUOTA SNAPSHOT — SerpAPI Account API result (free; no credit consumed).
--    Safe aggregate numbers only. NEVER account_email / api_key / account_id.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_quota_snapshot (
  quota_snapshot_id bigserial   PRIMARY KEY,
  run_id             uuid       NULL
                       REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,
  key_slot           text       NOT NULL,   -- 'SERP_API_1' | 'SERP_API_2'
  captured_at        timestamptz NOT NULL DEFAULT now(),
  captured_when       text      NOT NULL DEFAULT 'BEFORE_RUN', -- BEFORE_RUN | AFTER_RUN | MANUAL_CHECK

  plan_name             text    NULL,
  searches_per_month     integer NULL,
  plan_searches_left      integer NULL,
  total_searches_left      integer NULL,
  this_month_usage          integer NULL,
  rate_limit_per_hour        integer NULL,

  configured         boolean   NOT NULL DEFAULT true,
  reachable          boolean   NOT NULL DEFAULT false,
  error_safe          text     NULL
);

CREATE INDEX IF NOT EXISTS google_lens_keyword_quota_snapshot_slot_idx
  ON public.google_lens_keyword_quota_snapshot (key_slot, captured_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. COMPETITOR REVIEW — append-only, exactly like mahima_stpm_review.
--    An automated Lens match is a CANDIDATE, never an auto-validated
--    competitor; every result defaults to NEEDS_REVIEW.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_lens_keyword_competitor_review (
  review_id            bigserial PRIMARY KEY,
  competitor_result_id bigint    NOT NULL
                          REFERENCES public.google_lens_keyword_competitor_result(competitor_result_id) ON DELETE CASCADE,
  run_id               uuid      NOT NULL
                          REFERENCES public.google_lens_keyword_run(run_id) ON DELETE CASCADE,

  previous_status  text         NOT NULL,
  review_status    text         NOT NULL,  -- NEEDS_REVIEW | INCLUDED | EXCLUDED
  review_reason    text         NULL,
  reviewed_by      text         NOT NULL,
  reviewed_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_lens_keyword_competitor_review_cr_idx
  ON public.google_lens_keyword_competitor_review (competitor_result_id, reviewed_at DESC);

-- Latest review status per result — mirrors mahima_stpm_result_review_v.
-- A result with no review row yet reads as NEEDS_REVIEW via COALESCE at the
-- call site, never by writing a synthetic row here.
CREATE OR REPLACE VIEW public.google_lens_keyword_competitor_review_v AS
SELECT DISTINCT ON (competitor_result_id)
  competitor_result_id, review_status, review_reason, reviewed_by, reviewed_at
FROM public.google_lens_keyword_competitor_review
ORDER BY competitor_result_id, reviewed_at DESC, review_id DESC;

COMMIT;
