# Closure — Dilaksi Req1 CDN-Cache Fix + Req2 Live Summary Cards

**Date:** 2026-07-23

## Summary
Fixed Dilaksi Req1's Refresh button silently serving up-to-2-minute-stale CDN-cached responses (added `?refresh=1` → `Cache-Control: no-store`). Added a live Refresh path to Dilaksi Req2's 8 summary cards, re-fetching Shopify catalog/sales and GA4 organic sessions on demand while keeping Semrush Demand frozen (documented, intentional limitation — no API scope for that data). Restyled the Req2 Refresh button to match the shared `button.primary` convention.

## Linked files
- Evidence: `evidence/dilaksi/2026-07-23_req1-req2-live-refresh-fixes.md`
- Validation: `validation/dilaksi/2026-07-23_req1-req2-live-refresh-fixes.md`
- Commits: `ad855bd`, `ccfefd8`, `f25dc7b`

## Status: PASS (reconstructed retroactively — commits were already live/deployed)
**Reviewer:** Not recorded.
**Next step:** None. Unaffected by the same-day Dilaksi Req3 revert.
