# Handover — Dilaksi Req 2: All Collections Scope Expansion

**Title:** Continuation notes for Req 2 all-collections page
**Purpose:** Enable a future session to pick this up without re-deriving context
**Date:** 2026-07-07 · **Requirement number:** 2 · **Team member:** Dilaksi · **Team:** SEO

## What's done
- Shopify MCP connector confirmed pointed at `ledsone.co.uk` (was briefly `ledsone.de` — corrected before any pull).
- Full catalog pulled via Bulk Operations API: 5,179 products, 17,542 variants, 475 real collections.
- 30-day sales pulled via ShopifyQL (1,705 variants with nonzero activity; rest are true zero).
- Keywords derived for all 5,179 products (reused 2026-07-02 curated/auto map for 1,231 products; auto-derived the remaining 3,948).
- Semrush: 2,456 new unique keywords looked up across 25 batches (~24,560 API units, user-approved). All batch results saved individually and merged.
- GA4 organic sessions pulled fresh for the whole site (2,766 landing-page rows) — no per-collection filtering needed since GA4 doesn't scope by collection.
- SEO Priority rule (unchanged 6-condition rule) applied to all 5,179 rows.
- Both HTML pages rebuilt: `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` and `reports/dilaksi/dilaksi-req2-all-collections-product-priority.html`.
- All 7 AIOS docs written under `*_dilaksi_req2_all_collections_*` naming.

## What's NOT done
- **Not deployed to Vercel** — explicit approval required before deploy per the task rules; awaiting sign-off.
- Profit Margin remains N/A for every row (COGS still not in PostgreSQL) — this is expected and documented, not a gap to fix here.

## Design decision worth knowing
The original 5-collection page grouped products into `<section>` blocks per collection. With 475 collections and many products belonging to 5–15 collections each, that pattern would have massively duplicated rows and produced an unusably huge page. Instead: **one flat product list**, sorted by sales, with every collection a product belongs to shown as pills under its title, and a searchable `<select>` dropdown (475 options) replacing the old 5-button collection filter row. This was a judgment call, not explicitly specified — flag if the business wants a different structure (e.g., per-collection sub-pages, or a paginated/virtualized table for performance).

## Known limits to carry forward
- Auto-derived keywords for ~4,940 products are LOW/MEDIUM/AUTO confidence, not manually curated — same caveat as the original 30-product curated batch had HIGH confidence.
- The page is ~11.7 MB (vs. ~2.4 MB for the old 5-collection version) — loads fine in testing but is noticeably heavier; consider pagination/virtualization if this becomes a UX complaint.
- User explicitly chose "literally everything" for collection scope — includes seasonal/promo/vendor-batch/junk collections alongside real merchandising niches. If the business later wants a cleaner subset, that's a scoping change, not a bug.

## Next step for whoever picks this up
Get deployment approval from Kuberan/user, then run the standard Vercel deploy + live verification (HTTP 200, row count check, badge presence) exactly as done for the 2026-07-02 5-collection version.
