## Purpose
Close out the Sonya-scoped performance-page loading speed fix on muguntha.html.

## Summary
User reported muguntha.html's Employee Performance page taking too long to load data per person. Root cause: each staff tab fired 40 separate HTTP requests (20 months x sales+cost) on first load. Built a batch endpoint (`api/muguntha.js`'s `handlePerfBatch`, `?action=perf-batch&member=sonya`) that fetches all 20 months in one serverless invocation, scoped to Sonya only per user's request. Hit and fixed a follow-on bug during rollout: the batch endpoint's function needed a 300s time budget (to match the pre-existing 30-90s live-Shopify-scan behavior it now runs in-process) but was left at the old 60s limit, causing it to silently hang. Fixed and redeployed.

## Evidence
See `evidence/muguntha/2026-08-19_sonya-perf-batch-endpoint.md`

## Validation
See `validation/muguntha/2026-08-19_sonya-perf-batch-endpoint.md`

## Status
PASS — user confirmed manually ("ok perfect i ckeck mannually now fast"). Deployed to production, pushed to both Staff-requirements and aios-2.

## Reviewer
Kuberan

## Next step
Optional: extend the same batch pattern to Sajeepan/Kamsi/Jefri/Dilaksi tabs if the user wants the same speed improvement there too — currently only Sonya's tab uses the batch path, the rest still use the original 40-request-per-tab flow.
