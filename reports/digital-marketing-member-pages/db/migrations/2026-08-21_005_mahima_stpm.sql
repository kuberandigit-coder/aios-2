-- 2026-08-21_005_mahima_stpm.sql
--
-- REQ-DM-2026-08-MAHI01 — Mahima "Search Term -> Product Mapping" (STPM).
--
-- Target database: the DILAIKSHAN Neon DB reached through DILAIKSHAN_NEON_DB.
--   NEVER the Ledsone operational DB (that stays read-only, and stays the ONLY
--   source of current Google Ads / Shopify truth).
--   NEVER AUTH_DATABASE_URL (Thivajini feed + auth), NEON_DATABASE_URL
--   (SEMrush/GEO) or FEED_TRACKER_DB_URL. There is no fallback chain anywhere in
--   this feature — see lib/stpm/config.js.
--
-- WHY THESE TABLES EXIST
--   The dashboard must be able to reopen a run from weeks ago and show exactly
--   what the staff member saw, even though Ledsone keeps moving underneath it.
--   So a run is stored as an IMMUTABLE SNAPSHOT: the header records what was
--   asked and what the source actually offered; the result rows record the
--   computed evidence. Reopening a run reads these tables and never recomputes
--   against today's Ledsone data.
--
--   Human review is deliberately a SEPARATE table. An automated recommendation
--   can therefore never overwrite, or be mistaken for, a human approval, and the
--   full review history stays auditable.
--
-- ADDITIVE AND RE-RUNNABLE
--   IF NOT EXISTS throughout. No DROP. No TRUNCATE. Nothing outside the
--   mahima_stpm_* namespace is referenced or altered.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. RUN HEADER — one row per "Run now"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mahima_stpm_run (
  run_id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_no                          bigserial   NOT NULL,
  requirement_id                  text        NOT NULL DEFAULT 'DM-2026-08-MAHI01',

  created_by                      text        NOT NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  started_at                      timestamptz NULL,
  completed_at                    timestamptz NULL,

  -- CREATED | RUNNING | COMPLETED | COMPLETED_WITH_WARNINGS | FAILED
  status                          text        NOT NULL DEFAULT 'CREATED',
  status_detail                   text        NULL,

  -- What the user ASKED for.
  requested_start                 date        NULL,
  requested_end                   date        NULL,
  requested_preset                text        NULL,   -- 'last7' | 'custom'

  -- What was ACTUALLY used. These differ from the requested range when the
  -- approved 7 -> 14 day fallback fires. They are stored separately so the UI
  -- can never present 14-day data as 7-day data.
  actual_start                    date        NULL,
  actual_end                      date        NULL,

  fallback_used                   boolean     NOT NULL DEFAULT false,
  fallback_days                   integer     NULL,   -- 14 when the fallback fired
  fallback_reason                 text        NULL,

  -- Historical comparison window (non-overlapping with the current window).
  historical_start                date        NULL,
  historical_end                  date        NULL,
  historical_preset               text        NULL,   -- 'prev30' | 'prev60' | 'custom'

  -- Source freshness frozen at run start. ledsone_campaign_source_date is what
  -- makes the "campaigns are live but search-term ingestion is stale" condition
  -- provable after the fact rather than a guess.
  latest_search_term_source_date  date        NULL,
  latest_pmax_term_source_date    date        NULL,
  latest_campaign_source_date     date        NULL,
  shopify_catalogue_cutoff        timestamptz NULL,

  campaign_ids                    bigint[]    NOT NULL DEFAULT '{}',
  campaigns_selected              integer     NOT NULL DEFAULT 0,
  campaigns_with_data             integer     NOT NULL DEFAULT 0,
  campaigns_stale                 integer     NOT NULL DEFAULT 0,

  -- 'healthy' | 'fallback' | 'stale_ingestion' | 'no_data'
  source_health                   text        NULL,
  source_warnings                 jsonb       NOT NULL DEFAULT '[]'::jsonb,

  row_count                       integer     NOT NULL DEFAULT 0,
  negative_candidate_count        integer     NOT NULL DEFAULT 0,
  opportunity_count               integer     NOT NULL DEFAULT 0,
  product_match_count             integer     NOT NULL DEFAULT 0,

  total_clicks                    integer     NULL,
  total_impressions               integer     NULL,
  total_cost                      numeric(14,2) NULL,
  total_conversions               numeric(14,2) NULL,
  total_conversion_value          numeric(14,2) NULL,
  historical_conversions_total    numeric(14,2) NULL,
  historical_cost_total           numeric(14,2) NULL,
  historical_conversion_value_total numeric(14,2) NULL,

  -- Which versioned logic produced these rows. Lets a later rule change be told
  -- apart from a data change when two runs disagree.
  rule_version                    text        NULL,
  matching_version                text        NULL,
  canonical_source_rule           text        NULL,

  error_code                      text        NULL,
  error_summary                   text        NULL,

  -- Double-click / platform-retry safety.
  idempotency_key                 text        NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS mahima_stpm_run_idem_uidx
  ON public.mahima_stpm_run (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS mahima_stpm_run_created_idx
  ON public.mahima_stpm_run (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. RESULT ROWS — one row per search term per run (immutable evidence)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mahima_stpm_result (
  result_id                bigserial PRIMARY KEY,
  run_id                   uuid NOT NULL
                             REFERENCES public.mahima_stpm_run(run_id) ON DELETE CASCADE,

  search_term              text        NOT NULL,
  search_term_normalized   text        NOT NULL,
  campaign_id              bigint      NULL,
  campaign_name            text        NULL,
  campaign_type            text        NULL,   -- PERFORMANCE_MAX | SHOPPING | ...
  source_table             text        NULL,   -- which canonical source produced the row

  -- Source date span for THIS row, so a row can be trusted independently of the
  -- run header.
  source_start             date        NULL,
  source_end               date        NULL,

  clicks                   integer     NOT NULL DEFAULT 0,
  impressions              integer     NOT NULL DEFAULT 0,
  cost                     numeric(14,4) NULL,
  conversions              numeric(14,4) NOT NULL DEFAULT 0,
  conversion_value         numeric(14,4) NULL,

  -- NULL, never 0, when the denominator is 0. Fabricating a zero here would
  -- silently create a "0% CTR" or "0 ROAS" that the business never measured.
  ctr                      numeric(10,4) NULL,
  roas                     numeric(14,4) NULL,

  historical_conversions   numeric(14,4) NOT NULL DEFAULT 0,
  historical_cost          numeric(14,4) NULL,
  historical_conversion_value numeric(14,4) NULL,
  historical_clicks        integer       NULL,

  -- Working | Dropped | No Conversions
  performance_status       text        NULL,

  -- EVERY rule that fired, not only the "winning" one. The business has not yet
  -- ratified multi-rule precedence, so keeping the full set means a future
  -- precedence decision can be re-derived from stored evidence instead of
  -- forcing every historical run to be re-run.
  waste_reasons            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  waste_reason_summary     text        NULL,

  -- Negative Keyword | Keep | Keyword Opportunity   (no other value is emitted)
  decision                 text        NULL,
  decision_basis           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  negative_keyword_recommended boolean NOT NULL DEFAULT false,

  keyword_opportunity      boolean     NOT NULL DEFAULT false,
  opportunity_candidate    boolean     NOT NULL DEFAULT false,
  opportunity_reason       text        NULL,
  targeting_evidence       jsonb       NOT NULL DEFAULT '{}'::jsonb,

  intent_label             text        NULL,   -- product | informational | non_product | unknown
  intent_confidence        text        NULL,   -- deterministic | limited
  intent_evidence          jsonb       NOT NULL DEFAULT '{}'::jsonb,

  product_id               text        NULL,   -- Shopify item_id; NULL on No Match
  product_title            text        NULL,
  product_url              text        NULL,
  product_handle           text        NULL,
  match_type               text        NULL,   -- Exact | Phrase | No Match
  match_score              numeric(10,4) NULL, -- ranking evidence, NOT an approved probability
  match_source             text        NULL,   -- title | tag | meta_title | meta_description | description
  match_evidence           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  runner_up_score          numeric(10,4) NULL,
  mapping_status           text        NULL,   -- Auto Matched | Manual Review | No Match
  mapping_reason           text        NULL,

  data_quality_flags       jsonb       NOT NULL DEFAULT '[]'::jsonb,

  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mahima_stpm_result_run_idx
  ON public.mahima_stpm_result (run_id);
CREATE INDEX IF NOT EXISTS mahima_stpm_result_run_decision_idx
  ON public.mahima_stpm_result (run_id, decision);
CREATE INDEX IF NOT EXISTS mahima_stpm_result_run_term_idx
  ON public.mahima_stpm_result (run_id, search_term_normalized);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. HUMAN REVIEW — append-only audit, deliberately separate from B
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mahima_stpm_review (
  review_id        bigserial PRIMARY KEY,
  result_id        bigint NOT NULL
                     REFERENCES public.mahima_stpm_result(result_id) ON DELETE CASCADE,
  run_id           uuid   NOT NULL
                     REFERENCES public.mahima_stpm_run(run_id) ON DELETE CASCADE,

  previous_status  text        NULL,           -- Approved | Rejected | Pending
  review_status    text        NOT NULL,       -- Approved | Rejected | Pending
  reviewer         text        NOT NULL,
  reviewed_at      timestamptz NOT NULL DEFAULT now(),
  note             text        NULL
);

CREATE INDEX IF NOT EXISTS mahima_stpm_review_result_idx
  ON public.mahima_stpm_review (result_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS mahima_stpm_review_run_idx
  ON public.mahima_stpm_review (run_id);

-- Current review status per result = the latest row in C.
-- A result with no review row has never been touched by a human and is Pending.
CREATE OR REPLACE VIEW public.mahima_stpm_result_review_v AS
SELECT
  r.result_id,
  r.run_id,
  COALESCE(latest.review_status, 'Pending') AS review_status,
  latest.reviewer,
  latest.reviewed_at,
  latest.note
FROM public.mahima_stpm_result r
LEFT JOIN LATERAL (
  SELECT rv.review_status, rv.reviewer, rv.reviewed_at, rv.note
  FROM public.mahima_stpm_review rv
  WHERE rv.result_id = r.result_id
  ORDER BY rv.reviewed_at DESC, rv.review_id DESC
  LIMIT 1
) latest ON TRUE;

COMMIT;
