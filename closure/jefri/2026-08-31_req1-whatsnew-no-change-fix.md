# Closure — Sync Monitor "What's New" always showing "No change"

**Date:** 2026-08-31

## Summary
The Sync Monitor's Orders/Net Sales/"What's New" columns always read
"—"/"No change" for Jefri Req1 (and Req6/Req8) because
`ScheduledSnapshot.run_sync` never populated those `sync_history` columns
-- only the older Sales/Employee-Performance sync flow did. Added an
optional `metrics_fn` to `ScheduledSnapshot`, wired page-appropriate
metrics for Req1/Req6/Req8, and adjusted the diff labels so they read
correctly for pages that aren't literal order feeds. Verified via a live
manual sync: real numbers (2,508 products, €29,977.68 conv. value) now
flow through and "What's New" shows the actual delta.

## Status
PASS. Going forward every run for Req1/Req6/Req8 will carry real,
diffable metrics; the two runs that happened before this fix still show
null/"No change", which is expected and not backfilled.

## Reviewer
Pending user confirmation in the Sync Monitor UI.

## Evidence / Validation
See evidence/jefri/2026-08-31_req1-whatsnew-no-change-fix.md and
validation/jefri/2026-08-31_req1-whatsnew-no-change-fix.md
