---
task: Mahima Requirement 2 — Stock Management, Tab 2 on mahima.html
date: 2026-07-09
team_member: Mahima
---

## Title
Mahima Requirement 2 — Stock Management (Tab 2) — Report Note

## Purpose
Point-of-record summary of the report output and where the live working file sits.

## Requirement source
Kuberan, 2026-07-09

## Business question
Which Shopify products need restocking, monitoring, no restock yet, or stop purchasing based on
current stock and last 30-day sales?

## Shopify sources checked
ledsone.de Shopify Admin GraphQL bulk product export (2,524 products / 10,133 variants) +
ShopifyQL 30-day inventory report (10,233 rows). See evidence doc for full detail.

## Files created or modified
Working file: `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`
(Tab 2 added). Supporting data/scripts in `reports/mahima/data/2026-07-09_mahima_req2_*`.

## Evidence location
`evidence/mahima/2026-07-09_mahima_req2_stock_management_evidence.md`

## Validation result
PASS — `validation/mahima/2026-07-09_mahima_req2_stock_management_validation.md`

## Owner / Reviewer
Owner: Mahima · Reviewer: Kuberan

## Status
Done, local device only, pending review.

## Result summary
| Metric | Value |
|---|---|
| Total SKUs | 10,133 |
| Fast Moving (Restock) | 48 |
| Healthy (Monitor) | 11 |
| Slow Moving (Don't Restock Yet) | 336 |
| Never Moving (Stop Purchasing) | 9,728 |
| Data Missing (sales) | 10 |
| Data Missing (category) | 207 |

## Known limitations
See evidence/handover docs — category (2.0%), sales (0.1%), SKU (0.1%) gaps, all disclosed,
none fabricated.

## Next steps
Kuberan review → approve for push/deploy.

## PASS / FAIL result
**PASS**
