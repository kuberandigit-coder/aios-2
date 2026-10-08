# Capabilities — 2026-10-01

## Capability — Search Intent → Page Action Pipeline (deterministic, no-AI classification)

**Date:** 2026-10-01
**Owner:** Dilaksi (built by Kuberan)
**Project:** dm-dashboard
**Status:** Deployed and working

### Capability

A dev task that finds GSC queries whose search intent doesn't match the type of page currently
ranking for it, and turns that into an actionable, trackable SEO task list — using **entirely
deterministic, no-AI classification rules** (keyword-pattern intent detection: Navigational →
Informational → Commercial → Transactional, with a documented Transactional fallback; page-type
from URL path only), not an LLM call.

### Reusable technical choices

- **Real-data-only dropdowns**: `/sites` and `/weeks` reflect genuinely available data, never a
  hard-coded list — a site only appears if it actually has GSC rows for a real week.
- **Aggregation-before-classification performance design**: filters to
  `SUM(impressions) >= MIN_ROWS_FLOOR` in SQL before any row reaches Python classification,
  documented explicitly as a stated tradeoff (low-impression queries aren't worth classifying
  every week) rather than a hidden limitation.
- **Never fabricate a before/after comparison**: when no earlier/later week exists, the UI shows
  `"-"`, not a guessed or zero-filled value.

### Real bug found on first live deployment

`500 Internal Server Error` on every endpoint, root-caused via server logs to a **dict-row vs
tuple-row mismatch**: `get_conn()`/`get_business_conn()` are configured with psycopg's `dict_row`
factory, so every fetched row is a dict keyed by column name — but the router was written
throughout assuming tuple rows (`r[0]`). This is a reusable gotcha for any new backend module in
this project: **confirm the connection helper's row factory before writing any row-access code**,
don't assume tuple access works.

### Originating task

`closure/dilaksi/2026-10-01_search-intent-page-action_closure.md`

### Reuse

The intent/page-type classification rule-table itself (deterministic, documented fallback) is a
template for any future "does the ranking page type match what the searcher actually wants"
feature on another site.
