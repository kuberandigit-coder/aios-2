# Capabilities — 2026-09-14

## Capability — AI/GEO Visibility Gap Analysis Pattern (multi-key quota-rotating AI Overview detection)

**Date:** 2026-09-14
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Live, major new feature (~14 commits)

### Capability

A dev task detecting whether a brand/product appears in Google's AI Overview for a set of queries,
with: Semrush-style query variation generation, SearchAPI.io as the detection source (switched from
an initial Gemini-brand-mention-check approach, then from Search Console), **automatic quota-based
switching across up to 5 SearchAPI.io keys**, a prominent remaining-credits KPI card, bulk-select/
bulk-delete on results, and cleanup logic for AI Overview text containing embedded Shopping
carousels.

### Same-day build-then-revert cycles (2 instances, consistent with this project's iteration style)

1. A manual Claude-in-Chrome submission endpoint for AI Overview results was added, then removed
   the same day in favor of the automated SearchAPI.io approach.
2. The UI was redesigned to match Dilaksi's style, then reverted back to the original table-based
   layout, same day.

### Originating task

`closure/dm-dashboard/2026-09-14_ai-geo-visibility-gap-analysis.md`

### Reuse

The **multi-key automatic quota rotation** technique (up to 5 keys, switches when one runs low,
remaining-credits shown as a KPI) is reusable for any future feature depending on a
quota-limited third-party API.
