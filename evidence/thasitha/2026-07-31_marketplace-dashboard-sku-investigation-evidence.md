# Thasitha Task 2 — Marketplace Dashboard Investigation

**Date:** 2026-07-31
**Team member / Team / Store:** Thasitha / Google Ads / SEO / Marketplace

## Purpose

Investigate why a specific Shopify SKU is not appearing on the Marketplace dashboard.

## Requirement source

User-provided task summary, 2026-07-31.

## Business question

Why is a known Shopify SKU missing from the Marketplace dashboard, and is this a data-refresh/sync issue?

## Work completed

- Compared the Shopify SKU against what the Marketplace dashboard shows.
- Identified a SKU mismatch between Shopify and the dashboard.
- Reviewed the dashboard's refresh behaviour (how/when it updates).
- Prepared a technical investigation prompt for follow-up.
- Documented the probable cause as a refresh/update issue.

## Files created or modified

None specified in the source summary — this was an investigation, not a code change.

## PostgreSQL source checked

Not specified in the source summary (no exact table/query given). If the Marketplace dashboard is Postgres-backed, the relevant sync/staging table should be confirmed in the follow-up investigation.

## Evidence

Task summary supplied directly by the requester describing the SKU comparison, mismatch identification, and refresh-behaviour review as completed.

## Validation

See `validation/thasitha/2026-07-31_marketplace-dashboard-sku-investigation-validation.md`.

## Known limitations

- The specific SKU value was not provided in the source summary.
- The exact Marketplace dashboard (page/file) and its data source were not specified.
- Root cause is documented as "probable" (refresh/update issue) — not yet confirmed against the actual sync job or database state.

## Next step

Identify the exact SKU, dashboard page, and backing data source; confirm whether the refresh job is failing, delayed, or excluding this SKU by filter, then fix accordingly.

## PASS / FAIL

PASS — investigation completed and documented as scoped; root-cause confirmation remains outstanding and is the next step.
