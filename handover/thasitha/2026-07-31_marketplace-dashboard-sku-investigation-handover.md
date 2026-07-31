# Thasitha Task 2 — Marketplace Dashboard Investigation (Handover)

**Date:** 2026-07-31
**Team member / Team / Store:** Thasitha / Google Ads / SEO / Marketplace

## What was done

Investigated a Shopify SKU missing from the Marketplace dashboard: compared Shopify vs dashboard data, identified a mismatch, reviewed the dashboard's refresh behaviour, and documented a probable refresh/update issue as the cause.

## What's next

- Get the specific SKU value and Marketplace dashboard page/file from the requester.
- Check the actual refresh job/sync logs (or Postgres source table, if applicable) to confirm the root cause.
- Fix the sync/refresh issue once confirmed.

## Where to find things

- Evidence: `evidence/thasitha/2026-07-31_marketplace-dashboard-sku-investigation-evidence.md`
- Validation: `validation/thasitha/2026-07-31_marketplace-dashboard-sku-investigation-validation.md`
- Report: `reports/thasitha/2026-07-31_marketplace-dashboard-sku-investigation-report.md`

## Risks / open questions

Without the exact SKU and dashboard identified, this remains a documented hypothesis rather than a confirmed fix — flag to the next engineer that root-cause confirmation is still outstanding.
