# Capabilities — 2026-06-17

## Capability — Shopify→Google Sheets UTM/Product Attribution Extension Pattern

**Date:** 2026-06-17
**Owner:** Kuberan
**Project:** Ledsone — Analytics/Attribution (Google Apps Script, Shopify GraphQL Admin API)
**Status:** Code delivered; a date-filter bug was under diagnosis at the time this was written
(see Known limitations)

### Capability

Extend an existing, already-working Shopify→Google Sheets Apps Script with a new, narrower report
(Product × UTM attribution, filtered to a supplied Product ID list) **without rewriting or
breaking any existing function** — a reusable technique for adding a new report type onto a
mature attribution script rather than building a parallel one.

### What problem it solves

A new reporting requirement (product-scoped UTM/channel attribution for a specific product list)
arrived for a script that already had working order-fetching, UTM-parsing, and channel-attribution
logic. Rewriting that logic from scratch would risk breaking the existing reports it already
powers.

### Technical implementation

1. **Identify and reuse, don't rewrite.** Read the existing script first and explicitly listed
   which functions to reuse as-is (`fetchAllOrdersWithProducts`, `visitUtm`, `deriveChannel`,
   `getChannelColor`) versus what needed to change — before writing any new code.
2. **Dynamic ID-list loading, never hardcoded.** The ~95 supplied Product IDs are read from a
   `Product IDs` sheet tab at runtime, deduplicated via a `Set` — so the list can change without a
   code edit.
3. **Minimal additive GraphQL field, not a query rewrite.** Added exactly one new field
   (`product { id title productType }`) to the existing query, rather than restructuring it, to
   make line items filterable by product ID.
4. **Dual ID-type matching.** The product-ID matcher checks both `product.id` and `variant.id`,
   since either can appear depending on the data path — a genuine ID-type ambiguity worth checking
   for in any similar Shopify line-item matching work.
5. **Explicit Revenue-vs-Net-Sales definition, with a backward-compatible toggle.** Revenue =
   original price × qty (gross); Net Sales = discounted price × qty (net) — both defined and
   documented, with a toggle to reproduce the old "both discounted" behaviour, so adding the new
   distinction didn't silently change any existing report's numbers.
6. **Diagnostic-function technique for isolating a systemic bug.** When the new report's GraphQL
   date filter returned 0 orders (`Invalid timestamp for query filter created_at`), rather than
   guessing at a fix, a dedicated `testDateFilter()` function was written to test 4 different date
   formats and isolate whether the problem was format, value, or scope — before committing to a
   fix.

### Known limitations surfaced (reusable gotchas for any similar attribution work)

- **Shopify's `customerJourneySummary` (first-session UTM/channel data) only retains ~30 days.**
  Any order older than that will show "Unknown" for UTM/channel — this is a platform limit, not a
  bug, and revenue/unit figures remain correct regardless. Worth checking for in any future
  first-session-attribution report that looks back further than ~30 days.
- **Google Apps Script's 6-minute execution limit** means a journey-heavy query cannot process a
  large (e.g. 50k) order volume in one run — the recommended mitigation is month-by-month
  processing with an optional checkpoint/resume mechanism, not a single large query.
- **Hardcoded future-dated query ranges silently return zero rows** if the store's actual current
  date is earlier than the hardcoded range — the leading hypothesis for the date-filter bug this
  task was still diagnosing when written.

### Evidence

`evidence/old records/2026-06-17_LEDSONE_UTM_PRODUCT_REPORT_EXTENSION.md`

### Limitations of this capability record

This is the earliest capability-worthy task record found in a full historical AIOS audit
(2026-10-08) — written up from the single evidence file above, which itself notes the date-filter
bug was still open at the time. Whether that bug was ever resolved was not independently traced
forward through later task records as part of this backfill pass.
