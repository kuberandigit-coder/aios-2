-- =====================================================================
-- Migration : 2026-08-20_002_thivajini_feed_export_monitoring_push
-- Project   : DM-2026-08-THIV01 — Ledsone.fr Feed Optimization (Thivajini)
-- Target DB : APPLICATION-OWNED Neon Postgres
--             (FEED_TRACKER_DB_URL || AUTH_DATABASE_URL)
--
-- WHY A SECOND FILE RATHER THAN AMENDING 001
--   001 was committed to git (aaba945) and has been reviewed. Rewriting it
--   in place would silently change an artefact others have already seen.
--   002 is purely additive, so history stays honest.
--
-- ADDS
--   * export events           — every CSV download, with the exact column manifest
--   * monitoring plans        — go-live intent vs CONFIRMED go-live
--   * push history            — reserved for a FUTURE approved Merchant write
--
-- KEY BUSINESS RULE ENCODED HERE
--   Downloading a CSV does NOT prove the feed changed. A CSV export therefore
--   starts life as AWAITING_MANUAL_GO_LIVE, and `actual_go_live_date` stays
--   NULL until a human confirms it. The download timestamp is never silently
--   treated as the live timestamp.
--
-- SAFETY
--   Additive only. No DROP, no ALTER of an existing object, no TRUNCATE.
--   Does not read, alter or extend public.feed_optimization_tracker
--   (Sajeepan's UK ad-waste tracker) or any other team's table.
--   Re-runnable.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- I. EXPORT EVENT — one row per CSV download
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_export (
  export_id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              uuid        REFERENCES public.thivajini_feed_batch(batch_id) ON DELETE SET NULL,
  generation_ids        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  item_ids              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  variant_ids           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- The EXACT column manifest the operator chose, in order. Persisted so a
  -- historical CSV can be reproduced byte-for-byte from Neon.
  selected_columns      jsonb       NOT NULL,
  export_format         text        NOT NULL DEFAULT 'CSV',
  row_count             integer     NOT NULL DEFAULT 0,
  content_sha256        text,
  -- Monitoring intent captured at download time
  monitoring_start_date date,
  monitoring_start_mode text        NOT NULL DEFAULT 'TODAY',
  change_method         text        NOT NULL DEFAULT 'CSV_DOWNLOAD',
  change_status         text        NOT NULL DEFAULT 'AWAITING_MANUAL_GO_LIVE',
  baseline_snapshot_ids jsonb       NOT NULL DEFAULT '[]'::jsonb,
  notes                 text,
  generated_by          text        NOT NULL,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_export_format_chk
    CHECK (export_format IN ('CSV')),
  CONSTRAINT thivajini_feed_export_mode_chk
    CHECK (monitoring_start_mode IN ('TODAY','CUSTOM')),
  CONSTRAINT thivajini_feed_export_method_chk
    CHECK (change_method IN ('CSV_DOWNLOAD','MERCHANT_API')),
  CONSTRAINT thivajini_feed_export_status_chk
    CHECK (change_status IN ('AWAITING_MANUAL_GO_LIVE','CONFIRMED_LIVE','SCHEDULED','ABANDONED')),
  -- At least one data column must be exported.
  CONSTRAINT thivajini_feed_export_cols_chk
    CHECK (jsonb_typeof(selected_columns) = 'array' AND jsonb_array_length(selected_columns) >= 1)
);

CREATE INDEX IF NOT EXISTS thivajini_feed_export_batch_idx
  ON public.thivajini_feed_export (batch_id, generated_at DESC);

COMMENT ON TABLE public.thivajini_feed_export IS
  'One row per CSV download. The file itself is NOT stored — only the manifest needed to reproduce it and to link it to a monitoring plan.';
COMMENT ON COLUMN public.thivajini_feed_export.change_status IS
  'A download does not prove the feed changed. Default AWAITING_MANUAL_GO_LIVE until a human confirms the change is live.';
COMMENT ON COLUMN public.thivajini_feed_export.selected_columns IS
  'Ordered array of server-whitelisted column keys the operator chose. Internal Neon audit linkage is complete regardless of what the CSV contains.';

-- ---------------------------------------------------------------------
-- II. MONITORING PLAN — one row per (item, generation, selected variant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_monitoring (
  monitoring_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id                uuid        REFERENCES public.thivajini_feed_export(export_id) ON DELETE SET NULL,
  generation_id            uuid        REFERENCES public.thivajini_feed_generation(generation_id) ON DELETE CASCADE,
  selection_id             uuid        REFERENCES public.thivajini_feed_selection(selection_id) ON DELETE SET NULL,
  item_id                  text        NOT NULL,
  selected_variant_id      uuid        REFERENCES public.thivajini_feed_variant(variant_id) ON DELETE SET NULL,
  selected_variant_label   text,
  change_method            text        NOT NULL DEFAULT 'CSV_DOWNLOAD',
  intended_go_live_date    date,
  actual_go_live_date      date,                    -- NULL until a human confirms
  monitoring_start_date    date        NOT NULL,
  baseline_period_start    date,
  baseline_period_end      date,
  minimum_test_days        integer     NOT NULL DEFAULT 14,
  status                   text        NOT NULL DEFAULT 'AWAITING_MANUAL_GO_LIVE',
  baseline_snapshot_id     uuid        REFERENCES public.thivajini_feed_perf_snapshot(snapshot_id) ON DELETE SET NULL,
  latest_post_change_snapshot_id uuid  REFERENCES public.thivajini_feed_perf_snapshot(snapshot_id) ON DELETE SET NULL,
  monitoring_start_reason  text,       -- required when the operator overrides the default
  created_by               text        NOT NULL,
  confirmed_live_by        text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_mon_method_chk
    CHECK (change_method IN ('CSV_DOWNLOAD','MERCHANT_API')),
  CONSTRAINT thivajini_feed_mon_status_chk
    CHECK (status IN ('SCHEDULED','AWAITING_MANUAL_GO_LIVE','LIVE_TESTING','READY_FOR_REVIEW','CLOSED')),
  CONSTRAINT thivajini_feed_mon_mintest_chk
    CHECK (minimum_test_days >= 1),
  -- Once a plan is confirmed live it must carry who confirmed it.
  CONSTRAINT thivajini_feed_mon_confirm_chk
    CHECK (actual_go_live_date IS NULL OR confirmed_live_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS thivajini_feed_mon_item_idx
  ON public.thivajini_feed_monitoring (item_id, monitoring_start_date DESC);
CREATE INDEX IF NOT EXISTS thivajini_feed_mon_status_idx
  ON public.thivajini_feed_monitoring (status, monitoring_start_date);

COMMENT ON COLUMN public.thivajini_feed_monitoring.actual_go_live_date IS
  'The date a human confirmed the change was actually live. NEVER auto-filled from a download timestamp.';
COMMENT ON COLUMN public.thivajini_feed_monitoring.status IS
  'SCHEDULED = monitoring start is in the future (no baseline yet). AWAITING_MANUAL_GO_LIVE = exported but not confirmed live. LIVE_TESTING = confirmed live, inside the test window. READY_FOR_REVIEW = minimum_test_days elapsed.';
COMMENT ON COLUMN public.thivajini_feed_monitoring.minimum_test_days IS
  'Workflow rule: a verdict is not trusted before 14 days (PMax learning phase). Verdict logic remains the raw Google Ads comparison; the x2.9 attribution adjustment is NOT implemented.';

-- ---------------------------------------------------------------------
-- III. PUSH HISTORY — reserved for a FUTURE approved Merchant write
--      Created now so the audit trail exists before any write is enabled.
--      NOTHING in the application writes to this table in this deliverable.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thivajini_feed_push (
  push_id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id         uuid        REFERENCES public.thivajini_feed_generation(generation_id) ON DELETE SET NULL,
  selection_id          uuid        REFERENCES public.thivajini_feed_selection(selection_id) ON DELETE SET NULL,
  monitoring_id         uuid        REFERENCES public.thivajini_feed_monitoring(monitoring_id) ON DELETE SET NULL,
  item_id               text        NOT NULL,
  merchant_account_id   text        NOT NULL,
  product_input_resource text,      -- accounts/{acct}/productInputs/{id}
  product_resource      text,       -- accounts/{acct}/products/{id}
  offer_id              text,
  content_language      text,
  feed_label            text,
  data_source_id        text,
  data_source_type      text,
  method                text        NOT NULL,
  before_title          text,
  after_title           text,
  before_description    text,
  after_description     text,
  update_mask           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  push_state            text        NOT NULL DEFAULT 'NOT_ATTEMPTED',
  failure_category      text,
  provider_request_id   text,
  processed_verification_state text  NOT NULL DEFAULT 'NOT_CHECKED',
  processed_checked_at  timestamptz,
  monitoring_start_date date,
  pushed_by             text,
  requested_at          timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thivajini_feed_push_method_chk
    CHECK (method IN ('PRIMARY_API_PATCH','SUPPLEMENTAL_API_OVERRIDE')),
  CONSTRAINT thivajini_feed_push_state_chk
    CHECK (push_state IN ('NOT_ATTEMPTED','BLOCKED','PREVIEW_ONLY','REQUESTED','SUCCEEDED','FAILED','SOURCE_CHANGED_REVIEW_AGAIN')),
  CONSTRAINT thivajini_feed_push_verif_chk
    CHECK (processed_verification_state IN ('NOT_CHECKED','SUBMITTED','PROCESSING','VERIFIED','REJECTED_ISSUE'))
);

CREATE INDEX IF NOT EXISTS thivajini_feed_push_item_idx
  ON public.thivajini_feed_push (item_id, created_at DESC);

COMMENT ON TABLE public.thivajini_feed_push IS
  'Audit trail for a FUTURE approved Google Merchant Center write. No code path writes here in the 2026-08-20 deliverable. NEVER stores an access token.';
COMMENT ON COLUMN public.thivajini_feed_push.processed_verification_state IS
  'A successful productInputs.patch does NOT mean the processed Product reflects the change. VERIFIED requires reading the processed Product back and comparing.';
COMMENT ON COLUMN public.thivajini_feed_push.update_mask IS
  'Must only ever contain title and/or description. Price, availability, identifiers, images, GPC, shipping and tax are out of scope.';

COMMIT;

-- =====================================================================
-- ROLLBACK (manual, destructive — explicit decision only)
--   BEGIN;
--   DROP TABLE IF EXISTS public.thivajini_feed_push;
--   DROP TABLE IF EXISTS public.thivajini_feed_monitoring;
--   DROP TABLE IF EXISTS public.thivajini_feed_export;
--   COMMIT;
-- =====================================================================
