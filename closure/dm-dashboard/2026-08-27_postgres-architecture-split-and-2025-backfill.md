# Closure — Postgres architecture clarified (Sales vs Employee Performance split), 2025 historical backfill

**Date:** 2026-08-27
**Project:** dm-dashboard
**Source:** Claude session record (not git log)

## What was done
- Clarified real confusion around the Postgres caching setup: Sales
  sync and Employee Performance sync had been sharing one table
  (`sales_cache.snapshots`) — split into **separate standalone tables**
  per explicit instruction, each with its own independent pause switch
  (pausing one no longer affects the other).
- Confirmed and corrected the sync schedule to **Sri Lanka time**.
- Clarified scope: 2026 data should auto-sync hourly (it's live/
  ongoing); 2025 (and everything before Aug 2026) is historical —
  gather once, store, never needs a live refresh.
- **Database structure decision**: agreed to create a properly
  structured historical table for 2025 + pre-Aug-2026 data (not reusing
  the live 2026 table) — plan discussed and approved before building.
- **Large historical backfill run executed** for the 2025 data,
  monitored end-to-end (watched for failures/completion via a long-
  running backfill script) — user checked in repeatedly on progress and
  time remaining.
- **Sajeepan's historical data backfill** checked and completed.
- **Sonya**: new staff user created, page built and wired into the
  frontend, done step by step alongside the sales pages.

## Open items at end of day
- Some 2025/pre-Aug data backfill validation still ongoing at end of
  day (large multi-hour job).
