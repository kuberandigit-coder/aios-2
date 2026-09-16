## Duplicate-Risk Assessment — Dilaksi Requirement 07 (Meta Title & Description Audit)

## What was checked before creating anything new
1. **AIOS records** (`prompts/`, `evidence/`, `validation/`, `closure/`, `handover/`, `source-map/`, `capability/`) — grepped for `req07`, `requirement 07`, `meta audit`, `meta title`/`meta description` across all staff, not just Dilaksi. Found: Kamsi's Req5 "missing meta" work (a different staff member, different requirement number, different page — Kamsi's own `pages/kamsi.html` missing-meta detection, ported separately and unrelated to this Shopify+GA4+priority-backlog system) and Jefri's unrelated "Req 7" (BigQuery/Amazon/Shopify reconciliation — a completely different topic that happens to share the number 7). **No existing record for Dilaksi Requirement 07 or any Shopify+GA4 meta-audit-and-backlog system was found.** This is genuinely new work.
2. **dm-dashboard backend** — grepped for any existing whole-catalog (not collection-scoped) Shopify product+collection metadata fetcher, and any existing GA4-traffic-based priority/backlog system. `dev_tasks/geo_visibility/shopify.py`'s `fetch_collection_products()` is collection-scoped and fetches heavier per-product detail this audit doesn't need; no existing all-products-site-wide-with-only-metadata fetcher existed to reuse.
3. **Existing traffic threshold** — grepped for `high.?traffic`, `traffic.?threshold` across the whole backend. Only match: `hetheesha.py`'s Req4, which uses a binary "has any GSC clicks" scope, not a numeric HIGH/LOW cutoff. No reusable threshold existed.
4. **Capability folder** — reviewed every existing `capability/*.md` file; none document an "SEO metadata audit" or "traffic-based prioritization" capability. See the new capability record created alongside this one.

## Assessment
**No duplicate risk found.** This is new, non-overlapping work:
- Different requirement, different staff scope, different data pipeline than Kamsi's Req5 missing-meta work or Jefri's Req7.
- Reuses (does not duplicate) the existing Shopify client, existing GA4 client, existing database connection helper, and existing `dev-work` git branch/commit conventions.
- The one genuinely new piece of infrastructure (whole-catalog lightweight Shopify fetch) does not overlap with `geo_visibility`'s collection-scoped, heavy-detail fetch — different use case, different field set, no code duplicated between them (both call the same underlying `shopify_client.graphql()`, which is the point of that shared client).

## Conclusion
Proceed as new work — confirmed via search, not created without checking.
