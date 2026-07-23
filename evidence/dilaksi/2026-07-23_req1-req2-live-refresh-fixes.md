# Evidence — Dilaksi Req1 CDN-Cache Fix + Req2 Live Summary Cards

**Date:** 2026-07-23
**Commits:** `ad855bd` (feat), `ccfefd8` (style), `f25dc7b` (fix)

## Purpose
Two separate Dilaksi fixes: Req1's Refresh button could silently serve a CDN-cached response up to 2 minutes stale with no way to force a fresh fetch; Req2's 8 summary cards (Total Products/Variants, Sales 30d, Demand, Organic Sessions, High/Medium/Low/Low-flag priority) had no live-refresh path at all.

## Changes

### Req1 — CDN cache bypass (`f25dc7b`)
- `reports/digital-marketing-member-pages/api/requirement.js`: added `?refresh=1` support that sets `Cache-Control: no-store`, overriding the existing `s-maxage=120` CDN caching.
- `reports/digital-marketing-member-pages/pages/dilaksi.html`: wired the Refresh button's click handler to pass `refresh=1`.
- Verified live: two `refresh=1` calls a few seconds apart returned different `generatedAt` timestamps and `X-Vercel-Cache: MISS` both times.

### Req2 — live summary cards (`ad855bd`, `ccfefd8`)
- `reports/digital-marketing-member-pages/api/requirement.js`: new live endpoint logic — re-fetches Shopify catalog + 30-day order sales (`read_orders` scope) + GA4 organic sessions per product on demand.
- Demand (Semrush search volume) is explicitly **not** live — no `read_reports` scope for `shopifyqlQuery`, and Semrush itself was out of scope per instruction — served from a frozen snapshot (`api/data/dilaksi-req2-demand-frozen.json`, from the 2026-07-07 build) joined by `product_id`.
- SEO Priority is recomputed live from the approved 6-rule business logic using live Sales/Organic data combined with the frozen Demand figure.
- Verified: High/Medium/Low counts match the static page exactly (312/0/992); the ~27-product delta in Low-flag count matches new products added to the catalog since the 2026-07-07 snapshot.
- `pages/dilaksi.html`: added the Refresh button, then (`ccfefd8`) restyled it to a solid blue `button.primary` matching Kamsi/Jeffri/other pages instead of an outlined pill, and added "Refreshing…" loading text.

## Raw diff
See `git show ad855bd`, `git show ccfefd8`, `git show f25dc7b`.
