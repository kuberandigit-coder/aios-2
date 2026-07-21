---
title: 2026-07-21 Daily Log (Part 2) — Sales Dashboard Gross Sales Fix, Reassignment, Recovery
date: 2026-07-21
type: daily-doc
---

# Summary
Second block of today's session on `reports/digital-marketing-member-pages/pages/sales.html`. Started from the user manually cross-checking a month's Gross Sales figure against Shopify's own admin report, which led to finding and fixing two real calculation bugs affecting every tab on the page (missing order-level discounts, tax wrongly included in Gross Sales). Also permanently reassigned 41 France "No Journey Data" orders to Thivagini based on real Google Ads click evidence, added a tax+shipping-inclusive "Order Total" reconciliation card, recovered production from an unrelated GitHub auto-deploy outage, and fixed slow tab loads by generating missing snapshots.

# What Shipped
- Fixed store-wide Gross/Net Sales bug: order-level discounts now correctly allocated; tax (this store's VAT-inclusive pricing) now correctly excluded from Gross Sales — verified within ~0.3-0.4% of Shopify's own report.
- New "Order Total (incl. tax + shipping)" card on Hetheesha/Thivagini — verified exact match to Shopify's Total Sales.
- 41 France "No Journey Data" orders permanently reassigned Hetheesha → Thivagini, based on 90-day pre-purchase Google Ads click evidence, kept in a clearly labeled separate channel.
- Recovered production from a GitHub auto-deploy overwrite that briefly took the API down.
- Generated missing static snapshots for Hetheesha, Thivagini (all 6 closed months, none existed before) and Thasitha (May/June were missing, Jan-Apr regenerated with the fix) — fixed slow/failed tab loads.
- Confirmed all 8 non-Sajeepan tabs live and correct for July.

# Not Yet Done
- GitHub auto-deploy conflict risk — not resolved, user hasn't decided how to handle it yet.
- Mahima/Jeffri's already-cached historical snapshots not yet regenerated with today's tax/discount fix.
- Git commit/push — awaiting explicit user permission.

# Full Detail
See `evidence/sales/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment-evidence.md`, `validation/sales/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment-validation.md`, and `closure/sales/2026-07-21_sales-dashboard-tax-discount-fix-thivagini-reassignment-closure.md`.
