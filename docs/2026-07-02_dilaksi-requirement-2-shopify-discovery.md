# 2026-07-02 — Dilaksi Requirement 2: Shopify Sales Discovery

**Requirement Number:** 2 · **Source:** Google Sheet — Product Priority Guidance (Last 30 Days) · **Member:** Dilaksi (SEO)
**Business question:** SEO prioritisation of products/categories.

Discovery-only task, PASS. Verified with live queries: Category = Shopify Admin GraphQL collections (all 5 handles exist; 1,230 product memberships), SKU = product variants, Sales £/Units = ShopifyQL sales cube `SINCE -30d`. Join key product_id proven; correct column names documented (product_variant_sku, quantity_ordered). PostgreSQL has no Shopify sync tables — Shopify MCP is the sales source. No stop conditions; period "Last 30 Days" comes from the requirement.

- Evidence: `evidence/dilaksi/dilaksi-requirement-2-shopify-sales-discovery-evidence.md`
- Source map: `source-map/dilaksi-requirement-2-shopify-source-map.md`
- Prompt/validation/closure/handover: dilaksi-requirement-2-shopify-* files
- Next: approval for full extraction (~25 paginated calls), then build the Shopify columns of Requirement 2.

**PASS/FAIL:** PASS

---

## Update — GA4 Organic Sessions added (2026-07-02, later session)

Completed the Organic Sessions column: fetched remaining pendant-lights handle pages 2–4 via Shopify Admin GraphQL (pagination complete, hasNextPage=false), joined GA4 Data API organic landing CSV (property 408110563, Organic Search only, true last 30 days) to all 1,231 product rows by handle, added blue "org" badge (420 unique products nonzero, 1,360 sessions; verified 0 for the rest). Builder repointed to permanent `reports/dilaksi/data/` paths. Deployed to Vercel production and verified live (HTTP 200, 1,231 badges).

- Evidence: `evidence/2026-07-02_dilaksi-req2-ga4-organic-sessions.md`
- Validation: `validation/2026-07-02_dilaksi-req2-ga4-organic-sessions.md`
- Closure: `closure/2026-07-02_dilaksi-req2-ga4-organic-sessions.md`
- Live: https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req2-all-products.html

**PASS/FAIL:** PASS

---

## Update — Collection filter, Without-sales filter, detailed badges (2026-07-02, later session)

Added collection filter (All + 5 collections), 3-state sales filter (All / With sales / Without sales), plain-language demand and organic badges (`Demand: N searches/mo "keyword"`, `Organic: N visits (30d)`) with tooltips, a legend box explaining every badge and data source, and per-collection organic totals. Presentation-only change (same data). Deployed and verified live.

- Evidence: `evidence/2026-07-02_dilaksi-req2-collection-sales-filters.md`
- Validation: `validation/2026-07-02_dilaksi-req2-collection-sales-filters.md`
- Closure: `closure/2026-07-02_dilaksi-req2-collection-sales-filters.md`

**PASS/FAIL:** PASS

---

## Update — SEO Priority rule applied (2026-07-02, later session)

Applied the user-approved 6-condition SEO Priority rule to all 1,231 product rows: High 110 · Medium 0 · Low 435 · Low—flag for review 686 · Pending 0. Profit margin missing for all rows but provably unrequired (max product sales £1,995.12 < £4,000/£10,000 margin-rule thresholds) — nothing invented. Per-row log: `reports/dilaksi/data/2026-07-02_req2-seo-priority-log.csv`; independent re-check: 0 mismatches. Required note added on page. **NOT deployed — awaiting approval.** Full AIOS set: prompt/evidence(dilaksi)/validation/closure/handover/source-map/vercel, all dated 2026-07-02 `_dilaksi_req2_seo_priority_rule_*`.

**PASS/FAIL:** PASS (local) — deployment pending approval
