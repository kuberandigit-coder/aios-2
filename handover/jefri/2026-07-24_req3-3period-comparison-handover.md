# Handover — Jefri Requirement 3 (T-03), 3-Period Product Comparison

**Date:** 2026-07-24

## What was built
A new "Requirement 3" tab on `pages/jefri.html`, live-backed by a new Postgres endpoint (`/api/requirement?fn=jefri-req3`), comparing every product's Conv. Value and ROAS across three fixed calendar-quarter windows (Previous 3M = Oct-Dec 2025, Last 3M = Jan-Mar 2026, Prior-Year 3M = Apr-Jun 2025), with an Improved/Same/Drop status and a High/Mid revenue-tier classification.

## Where it lives
- Backend: `reports/digital-marketing-member-pages/api/requirement.js`, inside `jefriProductStatusHandlerModule` (same module as Req1/Req2, shares the Postgres connection pool).
- Frontend: `reports/digital-marketing-member-pages/pages/jefri.html`, third tab (`req3Tab`), fourth `<script>` block.

## Key decisions a future editor should know
1. **Products included:** any product with activity in *any* of the three periods (`UNION` of period IDs), not just products active in all three — a product that disappeared or newly appeared still shows up with `null`/"N/A" for the periods it has no data in.
2. **Tier is based on Last 3M only** — Previous/Prior-Year period data plays no role in Tier, only in Status.
3. **Status precedence when Conv. Value and ROAS disagree:** checked Improved → Drop → Same in that order. This wasn't explicit in the spec ("using Conv. Value OR ROAS") — documented as an assumption, not hidden.
4. **The gap between spec'd thresholds is intentionally left undefined** (e.g. a -20% change matches neither Same [-10 to +14%] nor Drop [<=-30%]) — shows as `—` rather than being forced into the nearest bucket.
5. **Data gap:** `google_ads.product_performance` for these 5 campaigns starts 2025-05-12, so Apr 1 - May 11 2025 (part of the Prior-Year 3M window) has zero real rows. This is disclosed in the page footnotes and is not something to "fix" by backfilling or estimating — there's no real data for that sub-range.
6. **Export Excel** is an HTML-table-as-`.xls` file (works fine in real Excel), not a true `.xlsx` binary — no xlsx library was added since none existed elsewhere in this codebase.

## Reused from Req1 (not reinvented)
- SKU resolution CTEs (`resolved_ids`, `child_fallback`, `resolved_listing`) — identical to Req1's, same `listings.shopify_listings`/`listings.shopify_listings_parent_child_mapping` join.
- `JEFRI_CAMPAIGN_IDS`, `CHANNEL` constants, `getPool()` connection helper.
- Cache/snapshot-fallback pattern (60s in-memory cache, static-snapshot fallback file if present, `?refresh=1` bypass) — matches Req1/Req2 exactly.
- IndexedDB client-side persistence (`jefri_r3_live` key) — same pattern added to Req1/Req2 earlier the same day, so a live fetch survives navigating away and back.

## Not touched
Requirement 1, Requirement 2, dashboard navigation shell, existing filters — verified via diff review before deploy.

## Outstanding
- No static snapshot file (`data/jefri-req3-snapshot.json`) exists yet — every non-forced load falls through to a live Postgres query (60s cache mitigates repeat hits). Could be added to the hourly `generate-snapshots.js postgres` mode job if this needs to be faster on cold loads.
- Awaiting Jefri's review of the Status precedence assumption and current tier/status distribution.
