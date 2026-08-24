-- 2026-08-21_004_thivajini_feed_export_deferred.sql
--
-- REQ-DM-2026-08-THIV01 — a download is not a go-live.
--
-- Migration 002 assumed every export immediately created a monitoring plan, so
-- monitoring_start_mode was constrained to ('TODAY','CUSTOM') and the start date
-- was mandatory. The agreed workflow now separates the two steps:
--
--     Download CSV  →  (staff uploads to Merchant Center by hand)  →  Start Monitoring
--
-- A download therefore records mode 'DEFERRED' with no monitoring start date and
-- no monitoring plan. Monitoring is created later, by an explicit human action
-- that supplies the real go-live date.
--
-- ADDITIVE AND RE-RUNNABLE. The DO blocks find the auto-generated constraint
-- names, so this works regardless of what Postgres called them.

BEGIN;

-- ── 1. allow the DEFERRED mode ───────────────────────────────────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'thivajini_feed_export'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%monitoring_start_mode%'
  LOOP
    EXECUTE format('ALTER TABLE public.thivajini_feed_export DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.thivajini_feed_export
  ADD CONSTRAINT thivajini_feed_export_start_mode_ck
  CHECK (monitoring_start_mode IN ('TODAY', 'CUSTOM', 'DEFERRED'));

-- ── 2. a deferred export has no monitoring start date yet ────────────────────
ALTER TABLE public.thivajini_feed_export
  ALTER COLUMN monitoring_start_date DROP NOT NULL;

-- ── 3. record the download-only status ───────────────────────────────────────
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'thivajini_feed_export'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%change_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.thivajini_feed_export DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.thivajini_feed_export
  ADD CONSTRAINT thivajini_feed_export_change_status_ck
  CHECK (change_status IN (
    'DOWNLOADED_NOT_LIVE',      -- file produced; nothing has changed anywhere
    'AWAITING_MANUAL_GO_LIVE',
    'CONFIRMED_LIVE',
    'SCHEDULED',
    'ABANDONED'));

COMMENT ON COLUMN public.thivajini_feed_export.change_status IS
  'DOWNLOADED_NOT_LIVE is the normal state after Customize & Download. It becomes '
  'CONFIRMED_LIVE only when a human confirms the upload through Start Monitoring.';

COMMIT;
