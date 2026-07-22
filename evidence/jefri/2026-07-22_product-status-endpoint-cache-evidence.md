# Evidence — Jefri Product-Status Endpoint Cache

**Date:** 2026-07-22
**Commit:** `7c8aaae`

## Problem
`api/requirement.js`'s product-status handler (Jefri Req1) ran a Postgres query and a live batched Shopify Admin GraphQL stock lookup on every request — including repeat hits from the same browser session switching tabs or changing filters. The Shopify stock lookup is throttling-prone under Shopify's GraphQL cost-based rate limiting.

## Fix
Added a short in-memory cache (60s TTL) keyed by campaign + date-range, matching the TTL/keying pattern already used elsewhere on this endpoint file. `?refresh=1` query param bypasses the cache to force a live re-pull.

## Diffstat
```
api/requirement.js | 24 ++++++++++++++++++++--
```
(24 insertions, 2 deletions — additive cache wrapper around the existing query path, not a rewrite.)

## Status
Evidence limited to commit message + diffstat; no independent live load-test was performed as part of this same-day AIOS recovery pass.
