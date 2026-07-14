---
title: SUK-R4 — Core GA4 Data for SEO — Requirement Prompt
requirement_id: SUK-R4
type: prompt
---

# Title
SUK-R4 — Core GA4 Data for SEO — Requirement Prompt

# Requirement ID
SUK-R4

# Purpose
Canonical requirement text used to build the Requirement 4 tab in
`pages/sukirtha.html`, preserved for reuse/re-verification.

# Business Question
Which landing pages on ledsone.de receive Organic Search traffic, how
are users engaging with those pages, and what search queries generate
that traffic during the last 30 days?

# GA4 Property
`462018160` (confirmed live 2026-07-14 — top hostname returned by a
live `runReport` test call was `ledsone.de`, 26,378 sessions/30d).

# GSC Property
`https://ledsone.de/` (URL-prefix property; access confirmed live
2026-07-13, reused for SUK-R1).

# Update Location
`reports/digital-marketing-member-pages/pages/sukirtha.html` — new
Requirement 4 tab added. No new HTML page created. Requirements 1–3
left unchanged.

# Approved Data Sources
GA4 Data API (Organic Search only, last 30 days), Google Search Console
API (last 30 days). Shopify not required — Page Type derived from URL
path pattern, no Shopify call needed.

# GA4 Filter
`sessionDefaultChannelGroup = Organic Search` (exact match).

# GA4 Metrics
Landing Page, Sessions, Users, Engagement Rate, Average Engagement Time
(derived: `userEngagementDuration / sessions`), Pages Per Session,
Purchase Revenue.

# Search Console Data
Dimensions: Page, Query. Metrics: Clicks, Impressions, CTR, Average
Position. Matched to GA4 Landing Page by URL path; Top Query = GSC
query with the most clicks for that page.

# Table Columns
Landing Page, Page Type, Top Query, Sessions, Users, Engagement Rate,
Average Engagement Time, Pages / Session, Purchase Revenue (€), Clicks,
Impressions, CTR, Average Position, Last Refreshed.

# Summary Cards
Organic Sessions, Organic Users, Landing Pages, Queries, Purchase
Revenue, Average Engagement Rate, Average Engagement Time, Pages /
Session.

# Filters
Search Landing Page, Search Query, Page Type, Sessions, Revenue, CTR.

# Table Features
Responsive, pagination, sorting, search, sticky header, CSV export.

# Do Not
Do not create another HTML page. Do not modify production GA4/GSC
config. Do not use sample/dummy/hardcoded data. Requested deploy to
Vercel and push to GitHub — both explicitly approved by the user in
this session (see handover doc for the exact confirmation exchange).

# Owner
Sukirtha

# Status
Built and deployed live.
