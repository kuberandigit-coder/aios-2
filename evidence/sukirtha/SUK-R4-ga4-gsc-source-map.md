---
title: SUK-R4 — GA4/GSC Source Map & Discovery Evidence
requirement_id: SUK-R4
type: evidence
---

# Title
SUK-R4 — GA4/GSC Source Map & Discovery Evidence

# Requirement ID
SUK-R4

# Purpose
Record exactly which GA4/GSC properties and fields feed the Requirement
4 tab, and the discovery steps that confirmed them.

# Business Question
Which landing pages on ledsone.de receive Organic Search traffic, how
are users engaging with those pages, and what search queries generate
that traffic during the last 30 days?

# GA4 Property
`462018160`. Discovery gap: every prior GA4 script in this repo
(Dilaksi's, Kamsi's "Core GA4 Data for SEO") used `properties/408110563`,
tied to ledsone.co.uk — not reusable for ledsone.de. User located the
correct property via GA4 Admin → Property → Property details and
supplied `462018160`. Verified live via a `runReport` test call
(`hostName` dimension, 30-day sessions): top hostname returned was
`ledsone.de` (26,378 sessions), confirming correct property before any
build work started.

# GSC Property
`https://ledsone.de/` (URL-prefix, not domain property). Access was
granted to the service account on 2026-07-13 for SUK-R1 and reused here
— no new grant needed.

# Service Account
`aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, key at
`C:\Users\PC\.keys\ga4-service-account.json`. Scopes used:
`analytics.readonly`, `webmasters.readonly`. Stored as Vercel production
env vars `GA4_PROPERTY_ID` and `GA4_SERVICE_ACCOUNT_JSON`
(user-approved write, both explicitly confirmed in chat before upload).

# Auth Method
Manual RS256 JWT signed with the service-account private key
(`node:crypto`), exchanged at `https://oauth2.googleapis.com/token` for
a Bearer access token — no `googleapis`/`google-auth-library` npm
dependency added, matching the zero-dependency pattern already used by
`sukirtha-req2-duplicate-check.js` / `sukirtha-req3-slow-moving-stock.js`.

# GA4 Fields Used
`landingPage` (dimension); `sessions`, `totalUsers`, `engagementRate`,
`userEngagementDuration`, `screenPageViewsPerSession`,
`purchaseRevenue` (metrics). Filter:
`sessionDefaultChannelGroup EXACT "Organic Search"`. Date range:
`30daysAgo` to `today`.

# GSC Fields Used
`searchAnalytics.query` with dimensions `page`, `query`; metrics
`clicks`, `impressions`, `ctr` (derived), `position`. Date range: last
30 full days (`YYYY-MM-DD` computed server-side, not a fixed date).

# Join Logic
GA4 `landingPage` and GSC `page` are both normalized to a URL path
(query strings/host stripped) and matched exactly. GSC rows are
aggregated per path: `clicks`/`impressions` summed, `avgPosition` is
impression-weighted, `topQuery` is the GSC query with the highest
`clicks` for that path. Landing pages with zero GSC rows show `topQuery:
null`, `clicks/impressions: 0`, `avgPosition: null` (never fabricated).

# Page Type Rule
Derived purely from the URL path — no Shopify call needed: `/` → Home,
`/products/*` → Product, `/collections/*` → Collection, `/blogs/*` or
`/blog/*` → Blog, `/pages/*` → Page, else Other.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html` (new
Requirement 4 tab added, Requirements 1–3 unchanged),
`reports/digital-marketing-member-pages/api/sukirtha-req4-ga4-seo.js`
(new).

# Live Retrieval (first production run, 2026-07-14T08:24:50Z)
Organic Sessions: 2,463 · Organic Users: 2,069 · Landing Pages: 869 ·
Queries: 8,016 · Purchase Revenue: €866.74 · Avg Engagement Rate: 89.75%
· Avg Engagement Time: 50s · Avg Pages/Session: 7.91.

# Owner
Kuberan (AIOS) / Claude Code session

# Status
Complete — live and verified.
