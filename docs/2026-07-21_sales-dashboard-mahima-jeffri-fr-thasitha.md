---
title: 2026-07-21 Daily Log — Sales Dashboard (Mahima, Jeffri, ledsone.fr, Thasitha)
date: 2026-07-21
type: daily-doc
---

# Summary

Full-day session on `reports/digital-marketing-member-pages/pages/sales.html` (the LEDSone staff sales dashboard). Corrected and finalized Mahima's Google Ads attribution rule against real Shopify order data (`utm_term` exact match on 8 confirmed values), rebuilt a standalone Jeffri tab (twice — after discovering its JS had been accidentally deleted, and after two rounds of rule correction), onboarded a brand-new store `ledsone.fr` with a fresh Shopify Admin token (never committed to any file — Vercel env var only), built standalone Hetheesha (Organic) and Thivagini (Google Ads + balance) tabs for that store, added a new Thasitha tab, and fixed a page-wide race condition where fast month-tab switching could show stale data from a previous selection.

# What Shipped
- Mahima: Organic + Google Ads (utm_term) sub-tabs, all 7 months.
- Jeffri: standalone tab, final rule = utm_term exact match (`jeff`/`Jeichitom_Maara`) + `utm_medium=SMARKETER_sale` fallback, all 7 months.
- Thasitha: standalone tab, utm_term=`thasi`, Jan–Apr cached (May/Jun pending).
- Hetheesha · FR (Organic) + Thivagini · FR (Google Ads + balance of non-organic channels) — new store `ledsone.fr` onboarded via Vercel env var `SHOPIFY_FR_ADMIN_TOKEN`.
- Fixed a real bug: Jeffri's entire JS block had been accidentally deleted during an earlier cleanup; rebuilt from scratch.
- Fixed a real bug: Thivagini was defined too narrowly (Paid Search only), leaving Social/Email/Affiliate orders uncounted by either FR tab — corrected so Hetheesha + Thivagini always sum to the store's exact monthly order total (verified: January 24+8=32, matching Shopify's raw count).
- Fixed a page-wide race condition across all load functions (month-switch could show a stale previous month's data) using a sequence-token pattern.
- Held serverless function count at 12 (Vercel Hobby plan cap) all day despite 5 new staff tabs, by extending the existing shared API file rather than creating new functions.

# Not Yet Done
- Thasitha May/June snapshot files.
- Hetheesha/Thivagini snapshot files (all months) — currently uncached, first load per month will be slow until generated.
- Git commit/push — awaiting explicit user permission (deployed to Vercel production only so far).

# Full Detail
See `evidence/sales/2026-07-21_sales-dashboard-mahima-jeffri-fr-thasitha-evidence.md`, `validation/sales/2026-07-21_sales-dashboard-mahima-jeffri-fr-thasitha-validation.md`, and `closure/sales/2026-07-21_sales-dashboard-mahima-jeffri-fr-thasitha-closure.md`.
