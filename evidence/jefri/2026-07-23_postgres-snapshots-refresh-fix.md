# Evidence — Jefri Req1/Req2 Postgres Snapshots + Refresh Buttons Actually Live

**Date:** 2026-07-23
**Commits:** `5057d54` (feat, Jefri portion), `3b558e8` (fix)

## Purpose
Jefri's Req1 (Product Status Labels) and Req2 (Search Terms) endpoints had an in-memory 60s cache but no durable snapshot, so cold starts (new Lambda instance) still ran the full Postgres query. Separately, both Refresh buttons on `jefri.html` were calling the exact same fetch as the initial page load — clicking Refresh could silently return the 60s-cached response with no way to force a live re-query, and no visual difference between a cache hit and a fresh fetch.

## Changes

### `reports/digital-marketing-member-pages/api/requirement.js`
- Added hourly-refreshable static snapshot files for Jefri Req1 (`jefri-product-status-snapshot.json`) and Req2 (`jefri-search-terms-snapshot.json`), read as a fallback before falling through to the live Postgres query — same durability pattern as the July sales snapshots (survives cold starts, unlike the in-memory `JEFRI_CACHE`/`JEFRI_CACHE2` maps).
- Added `api/scripts/generate-jefri-snapshots.js` to regenerate both files.

### `reports/digital-marketing-member-pages/pages/jefri.html`
- Both Refresh buttons now pass `?refresh=1` on click only (not on initial load), so a manual click provably bypasses the snapshot/cache and re-queries Postgres live. Confirmed live: `refresh=1` requests return a fresh `generatedAt` with no `cacheStatus`, vs. a normal load returning `cacheStatus: "static-snapshot"`.

### Also in `5057d54`
- Jefri's card on `home.html` updated to "2 Reports Live" (Req1 + Req2).

## Raw diff
See `git show 5057d54` and `git show 3b558e8`.
