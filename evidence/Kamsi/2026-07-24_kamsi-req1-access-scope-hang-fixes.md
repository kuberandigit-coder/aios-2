# Evidence — Kamsi Req1: Access-Scope Error + Refresh Hang Fixes

**Date:** 2026-07-24
**Commits:** `f6cd3ad`, `5e3408b`

## Purpose
Kamsi Requirement 1 (`kamsi.html`) was throwing a fatal "Failed to load: Access denied for name field" error, and separately, its Refresh button would hang indefinitely with no feedback.

## What Was Done
1. **Access-scope error (`f6cd3ad`):** Requirement 1's inventory GraphQL query requested `location { id name }`, which needs a `read_locations`/`read_markets_home` scope the UK Shopify token does not have. Only `quantities.available` was actually used by the page, so the unused `location` field was removed from `api/requirement.js`. Also wired the header's "Sales window" / "Last updated" text to the live response's `dateRangeStart/dateRangeEnd/retrievedAt` fields via a new `k1SetSummary()` handler — previously hardcoded to the original build date and never updated on Refresh.
2. **Refresh hang (`5e3408b`):** Root cause confirmed via a direct curl test that hung 100+s with zero bytes returned — `handleReq1` had no caching and re-scanned the full 13,866-SKU UK catalog (~278 paginated GraphQL calls) plus a full 90-day order history on every click, compounded by Shopify's per-page cost throttling. Added a 10-minute in-memory cache to `handleReq1` (bypassable with `?refresh=1`), and a client-side 290s `AbortController` timeout on the Req1/5/6 loader so a hung request now surfaces a clear error instead of spinning forever.

## Files Changed
- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/kamsi.html`

## Status
Deployed/committed same day.

## PASS/FAIL
PASS (reconstructed from commit message + diff; no independent live re-test performed in this sync).

## Next Step
None — superseded by the IndexedDB persistence work later the same day (see `2026-07-24_kamsi-req1-4-5-6-indexeddb-persistence.md`).
