# Evidence — Dilaksi Req 3 rebuilt: ALL live collections (473), dummy rows removed

**Date:** 2026-07-03 · **Team member:** Dilaksi (SEO) · **Reviewer:** Kuberan
**Purpose:** Kuberan requested the Req 3 page cover every collection in the LEDSone UK store with full data (like the wall-light row), and the 4 dummy 404 URLs removed.

## Scope decision
Shopify Admin holds 383 collections, but many are app/internal (Seguno, config-*, catalog_*, test). The page uses the **site's own sitemap chain** (sitemap.xml → sitemap_collections_1.xml) = **473 published collection URLs** — the true set of live collection pages.

## Data collected (all real, bulk-fetched)
| Source | Method | Result |
|---|---|---|
| GA4 | Data API, one bulk query, landingPage begins /collections/, Organic Search only, 2025-07-04→2026-07-03 | 986 landing-page rows → 316 collections with sessions; 18,428 sessions across the 473 listed |
| GSC | Search Analytics API, page contains /collections/, same 12m window | 8,664 page rows → 6,596,185 impressions on listed collections |
| Semrush | backlinks_pages report (root domain, sorted by backlinks; reached 0-backlink pages, so unlisted = genuinely 0) | 94 collection pages with backlinks |
| Live status + titles | Individual HTTP GET to all 473 URLs (throttled 1.2s; first-run DNS failures re-checked) | **473/473 HTTP 200**; titles from live <title> tags |
| Nav links | Homepage <header>/<footer> HTML parse | 63 header + 9 footer collection links → 70 unique collections deliberately linked |

## Page changes
- 4 dummy 404 rows removed; table now has all 473 live collections, sorted by GA4 sessions.
- Added client-side search box + sortable columns (essential at 473 rows).
- Summary cards: 473 live · 473 HTTP-200 verified · 18,428 sessions · 6.6M impressions · **15 zero-signal collections** (0 sessions + 0 impressions + 0 backlinks = removal candidates) · 70 nav-linked.
- Builder: `reports/dilaksi/data/2026-07-03_req3-allcol-page-builder.py` (single source of truth; rerun after refreshing CSVs).
- Data CSVs: `2026-07-03_req3-allcol-*.csv` + sitemap list.

## Commits
- Private aios-2: `f11d976` · Shared Staff-requirements: `6206d74` (auto-deploys via Vercel git integration)

**PASS/FAIL:** PASS — every cell from a real source or derived from one; no invented data. RAG: GREEN.
