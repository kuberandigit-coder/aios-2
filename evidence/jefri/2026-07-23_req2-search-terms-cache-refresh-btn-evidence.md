# Evidence — Jefri Req2 Search-Terms Cache + Refresh Button

**Date:** 2026-07-23

## Purpose
Follow-up perf fix for Jefri Requirement 2 (Search Terms report, `pages/jefri.html`): the endpoint query returns 50k+ rows and was taking ~10s per request with no caching, on every tab switch / filter change.

## Changes

### `reports/digital-marketing-member-pages/api/requirement.js`
- Added `JEFRI_CACHE2` (separate `Map` from Req1's `JEFRI_CACHE` — never shared) with a 60-second TTL, keyed by `'jefri-search-terms'`.
- `jefriSearchTermsHandler` now checks the cache first; serves cached payload if fresh (unless `?refresh=1` is passed).
- On cache miss/expiry/refresh, runs the original Postgres query, builds the payload, stores it in `JEFRI_CACHE2`, then responds.

### `reports/digital-marketing-member-pages/pages/jefri.html`
- CSS-only: extended `.tbar button, #refreshBtn` selector group to include `#r2RefreshBtn`, so the new Req2 refresh button matches existing button styling (default, `:hover`, `:disabled` states).

## Raw diff
See `git diff` on the two files above (working tree, not yet committed at time of writing).
