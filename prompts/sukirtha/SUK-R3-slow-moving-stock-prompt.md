---
title: SUK-R3 — Slow-Moving Stock Identification — Prompt
requirement_id: SUK-R3
type: prompt
---

# Title
SUK-R3 — Slow-Moving Stock Identification — Original Prompt

# Requirement ID
SUK-R3

# Purpose
Preserve the exact requirement spec used to build this dashboard.

# Requirement Source
User-provided structured task spec, 2026-07-14, addressed to "the execution
worker for Sukirtha's approved AIOS project."

# Business Question
Which Shopify product variants on ledsone.de sold fewer than 10 units
during the last 90 days while currently holding more than 100 units of
stock?

# Shopify Store
ledsone.de (ledsone-de.myshopify.com)

# Spec Summary
- Add Requirement 3 as a new tab in the existing `sukirtha.html`. Preserve
  Requirement 1 and Requirement 2 fully.
- Shopify-only, read-only. No PostgreSQL/CSV/mock data.
- One row per Shopify Variant ID (not SKU alone).
- 90-day window computed from query execution date, not fixed.
- Units Sold (90d) = eligible line-item quantity net of reliably-mapped
  refunds, joined by Variant ID; excludes cancelled/test/voided orders.
- Current Stock = Shopify inventory `available` quantity, summed across
  documented operational location(s); "Not Tracked" (never 0) when
  inventory isn't tracked.
- Status: strict `Units Sold < 10 AND Current Stock > 100` → Slow-Moving;
  not-tracked → Not Assessable; else OK. Explicit boundary test cases
  given (9/101, 10/101, 9/100, 0/150).
- 13 required columns, 11 summary cards, 10 filter dimensions, CSV export.
- Do not deploy to Vercel or push to GitHub without separate written
  approval (both explicitly withheld in this requirement).
- Mid-session, user instructed: "this one also need live use the same api
  and start" — interpreted as approval to skip the formal discovery-report
  gate and build directly, reusing the SUK-R2 live-endpoint pattern
  (server-side Shopify token, serverless function, no static snapshot).

# Owner
Sukirtha

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan

# Queryability Reviewer
Tamil Selvan

# Business Validator
SEO Lead / Inventory Owner

# Status
Built. Not deployed (explicit hold in this requirement). Not pushed.
