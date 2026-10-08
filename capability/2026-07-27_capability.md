# Capabilities — 2026-07-27

2 capabilities documented from this day's work.

---

# Capability — Meta UK Tab + Cross-Tab Order Overlap Discovery Method

**Date:** 2026-07-27
**Owner:** Kuberan
**Staff/Requirement:** Meta UK (new tab), discovery affects Kamsi/Dilaksi/Sajeepan/Sonya/DM
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (Meta UK tab live); overlap issue documented, not yet resolved on the main dashboard

## Capability
Detect whether multiple staff dashboard tabs are silently double-counting the same underlying orders, by directly comparing order-name sets across each tab's raw JSON — not just eyeballing summary totals.

## What Was Implemented
Added a Meta UK tab (Social-channel orders not claimed by any existing Ads tab). While investigating it, ran a direct order-name intersection across 6 UK tabs' January data and found 48% of orders appear in 2+ tabs.

## Technical Knowledge
- Two tabs can each have a "correct" total sales number individually, yet still double-count real orders when their underlying definitions aren't mutually exclusive (product-scope vs. traffic-source-scope). Summary-level totals alone cannot catch this — only an order-ID-level set comparison across the raw data can.
- Reusable check: for any set of dashboard tabs claiming to report on "the same store," pull each tab's `all*Orders` array, build a `Map<orderName, [tabsThatMatched]>`, and flag any entry with more than one tab.

## Files / Components
- `reports/digital-marketing-member-pages/api/sales.js` (Meta UK handler, `socialAudit`/`paidSearchGapAudit`/`firstSessionSplit` on `ukTotalDebugHandler`)
- `reports/digital-marketing-member-pages/pages/sales.html`

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), existing per-tab JSON snapshots in `api/data/`.

## Validation
Live-verified Meta UK tab; overlap finding independently reproduced via direct file comparison (not just a one-off claim).

## Reuse
Run the same order-name-set comparison before trusting any "combined total across tabs" figure on this dashboard — the answer directly motivated a whole new page (`salesuk.html`).

## Evidence
`evidence/digital-marketing-member-pages/2026-07-27_meta-uk-tab-and-order-overlap-discovery.md`

## Limitations
Meta UK tab has no static snapshot yet (live-fetch only, slow cold load). The overlap problem itself is not fixed on the main dashboard — only worked around via the new standalone page.

---

# Capability — Standalone Order-Level Sales Page with Mutually-Exclusive Groups

**Date:** 2026-07-27
**Owner:** Kuberan
**Staff/Requirement:** UK order-level review (DM-Ad, Meta groups so far)
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed (January live); Feb-Jul not yet built

## Capability
Build a second, fully independent dashboard page/backend from scratch when the existing one has a structural correctness problem (order double-counting) that shouldn't be silently patched into the tool people already trust.

## What Was Implemented
`api/salesuk.js` (new, zero shared code with `api/sales.js`) + `pages/salesuk.html`. A `GROUPS` array is checked in a fixed priority order; `assignGroup()` returns the first match, so no order can ever be assigned to two groups — exclusivity is a property of the code structure, not a rule someone has to remember to maintain. Order-level (not line-item-level) rows, full session history via an expandable panel, static-snapshot fast path (35s first-generation, ~2s after) mirroring the pattern already proven on `api/sales.js`.

## Technical Knowledge
- **Mutual exclusivity by construction**: when several "which staff/campaign owns this order" rules need to coexist without overlap, model them as an ordered list checked top-to-bottom with first-match-wins, rather than N independent boolean checks that each get evaluated in isolation (which is how the original per-staff tabs on `sales.html` ended up overlapping).
- **Order-level vs line-item-level rows**: reuse the same tax-inclusive-price fix and journey/session-building logic from `api/sales.js`, but aggregate to one row per order instead of one row per line item, when the requirement explicitly says "no product ID."
- Live full-month Shopify scans need BOTH a bigger GraphQL page size (100, not 50) AND a static-snapshot fast path — neither alone was enough to keep a cold page load under Vercel's function timeout for ~2,500-order months.

## Files / Components
- `reports/digital-marketing-member-pages/api/salesuk.js` (new)
- `reports/digital-marketing-member-pages/pages/salesuk.html` (new)
- `reports/digital-marketing-member-pages/home.html` (nav link, home.html only)
- `reports/digital-marketing-member-pages/vercel.json`
- `reports/digital-marketing-member-pages/api/data/salesuk-dm-ad-2026-01.json`, `salesuk-meta-2026-01.json`

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), `SHOPIFY_UK_ADMIN_TOKEN`.

## Validation
Both groups live-verified with correct order counts/net sales; exclusivity verified by code review of `GROUPS`/`assignGroup()`, not just by spot-checking output.

## Reuse
Template for adding further groups to this same page (e.g. Direct, Organic Search, Referral, Email, "No Journey Data" — the remaining first-session buckets from the January split) — just append to `GROUPS` after the existing entries, never insert earlier without re-checking what it would now steal.

## Evidence
`evidence/salesuk/2026-07-27_standalone-order-level-page.md`

## Limitations
Only January is wired up (`SUPPORTED_MONTHS = ['2026-01']` in `api/salesuk.js`). Extending to Feb-Jul requires updating that list and generating new snapshots per month per group.

