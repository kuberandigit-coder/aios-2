-- 2026-08-21_003_thivajini_feed_cycle.sql
--
-- REQ-DM-2026-08-THIV01 — one-button Optimization Cycle.
--
-- Target database: the APPLICATION Neon DB reached through AUTH_DATABASE_URL.
-- NEVER the Ledsone operational DB. NEVER NEON_DATABASE_URL (SEMrush/GEO).
--
-- WHY THESE TABLES EXIST
--   A Vercel Function cannot hold a 10-product run in memory: it can be frozen,
--   retried or duplicated at any moment. The cycle therefore lives in Postgres
--   as a state machine. Every advance() call reads the durable state, does ONE
--   unit of work, writes the new state, and returns. A refresh, a double click
--   or a platform retry all converge on the same row.
--
-- ADDITIVE AND RE-RUNNABLE
--   IF NOT EXISTS throughout. No DROP. No TRUNCATE. Nothing outside the
--   thivajini_feed_* namespace is referenced or altered.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. CYCLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.thivajini_feed_cycle (
  cycle_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_no            bigserial   NOT NULL,
  batch_id            uuid        NULL,
  created_by          text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz NULL,
  finished_at         timestamptz NULL,

  -- CREATED | PREPARING | EVALUATING_PRODUCTS | FETCHING_SEARCH_EVIDENCE
  -- GENERATING | VALIDATING | BUILDING_REPORT
  -- COMPLETED | COMPLETED_WITH_WARNINGS | FAILED
  status              text        NOT NULL DEFAULT 'CREATED',
  status_detail       text        NULL,

  -- Operator choices for this run (product count, priority filter, and the
  -- explicit draft-for-CHECK decision). Stored so a cycle stays explainable.
  settings            jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Source cutoffs frozen at cycle start, exactly as the batch does.
  ads_perf_cutoff             date NULL,
  pmax_terms_cutoff           date NULL,
  conventional_terms_cutoff   date NULL,

  products_total      integer     NOT NULL DEFAULT 0,
  products_done       integer     NOT NULL DEFAULT 0,
  products_generated  integer     NOT NULL DEFAULT 0,
  products_check      integer     NOT NULL DEFAULT 0,
  products_failed     integer     NOT NULL DEFAULT 0,
  products_skipped    integer     NOT NULL DEFAULT 0,

  llm_calls           integer     NOT NULL DEFAULT 0,
  gemini_calls        integer     NOT NULL DEFAULT 0,

  -- IDEMPOTENCY. A double click, a browser refresh or a Vercel retry all send
  -- the same key, so only the first one creates a cycle.
  idempotency_key     text        NULL,

  error_message       text        NULL
);

-- One cycle per idempotency key. This is what makes "Run" safe to press twice.
CREATE UNIQUE INDEX IF NOT EXISTS thivajini_feed_cycle_idem_uq
  ON public.thivajini_feed_cycle (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS thivajini_feed_cycle_created_idx
  ON public.thivajini_feed_cycle (created_at DESC);
CREATE INDEX IF NOT EXISTS thivajini_feed_cycle_status_idx
  ON public.thivajini_feed_cycle (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. CYCLE PRODUCT — per-product state, so one failure cannot kill the run
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.thivajini_feed_cycle_product (
  cycle_product_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id            uuid        NOT NULL
                        REFERENCES public.thivajini_feed_cycle(cycle_id) ON DELETE CASCADE,
  seq                 integer     NOT NULL,
  item_id             text        NOT NULL,

  -- WAITING | EVIDENCE | GATE | BASELINE | TERMS | GENERATING | VALIDATING
  -- GENERATED | CHECK_REQUIRED | SKIPPED | FAILED | VALIDATION_FAILED
  state               text        NOT NULL DEFAULT 'WAITING',
  state_detail        text        NULL,

  -- Feed Gate outcome, captured at the moment the gate was evaluated.
  gate_status         text        NULL,   -- ELIGIBLE | CHECK | NOT_ELIGIBLE
  gate_source         text        NULL,   -- SOURCE | DERIVED_APPROVED_RULE | UNVERIFIED
  gate_reasons        jsonb       NULL,

  -- Staff-facing outcome for the final report.
  -- Generated | Skipped — Feed Gate | Skipped — insufficient evidence
  -- Generation failed | Validation failed
  result_code         text        NULL,
  result_note         text        NULL,

  evidence_snapshot   jsonb       NULL,
  data_quality        jsonb       NULL,
  terms_count         integer     NOT NULL DEFAULT 0,
  generation_id       uuid        NULL,
  selected_variant    text        NULL,
  excluded_from_export boolean    NOT NULL DEFAULT false,

  started_at          timestamptz NULL,
  finished_at         timestamptz NULL,
  error_message       text        NULL,

  UNIQUE (cycle_id, item_id)
);

CREATE INDEX IF NOT EXISTS thivajini_feed_cycle_product_cycle_idx
  ON public.thivajini_feed_cycle_product (cycle_id, seq);
CREATE INDEX IF NOT EXISTS thivajini_feed_cycle_product_state_idx
  ON public.thivajini_feed_cycle_product (cycle_id, state);

-- ─────────────────────────────────────────────────────────────────────────────
-- C. CYCLE EVENT — the audit timeline shown on cycle.html
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.thivajini_feed_cycle_event (
  event_id            bigserial PRIMARY KEY,
  cycle_id            uuid        NOT NULL
                        REFERENCES public.thivajini_feed_cycle(cycle_id) ON DELETE CASCADE,
  at                  timestamptz NOT NULL DEFAULT now(),
  level               text        NOT NULL DEFAULT 'INFO',  -- INFO | WARN | ERROR
  item_id             text        NULL,
  message             text        NOT NULL,
  detail              jsonb       NULL
);

CREATE INDEX IF NOT EXISTS thivajini_feed_cycle_event_cycle_idx
  ON public.thivajini_feed_cycle_event (cycle_id, event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Link an export and a monitoring plan back to its cycle.
--    Additive columns only — existing rows keep NULL.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.thivajini_feed_export
  ADD COLUMN IF NOT EXISTS cycle_id uuid NULL;
ALTER TABLE public.thivajini_feed_monitoring
  ADD COLUMN IF NOT EXISTS cycle_id uuid NULL;

CREATE INDEX IF NOT EXISTS thivajini_feed_export_cycle_idx
  ON public.thivajini_feed_export (cycle_id);
CREATE INDEX IF NOT EXISTS thivajini_feed_monitoring_cycle_idx
  ON public.thivajini_feed_monitoring (cycle_id);

COMMIT;
