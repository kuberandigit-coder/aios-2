---
title: SUK-R2 — Duplicate Listing & Price Check — Prompt
requirement_id: SUK-R2
type: prompt
---

# Title
SUK-R2 — Duplicate Listing & Price Check — Original Prompt

# Requirement ID
SUK-R2

# Purpose
Preserve the exact requirement spec used to build this dashboard, so another
LLM or reviewer can reconstruct intent without re-asking the user.

# Requirement Source
User-provided structured task spec, 2026-07-14, addressed to "the execution
worker for Sukirtha's approved AIOS project."

# Business Question
Which Shopify product variants on ledsone.de use the same SKU across
multiple listings, and do those duplicate listings have different current
prices or compare-at prices?

# Shopify Store
ledsone.de (ledsone-de.myshopify.com)

# Full Spec Summary
- Add Requirement 2 as a new tab inside the existing
  `reports/digital-marketing-member-pages/pages/sukirtha.html` — no new page.
- Preserve Requirement 1 (Low CTR Blog/Collections) completely.
- Shopify-only, read-only data source. No PostgreSQL/CSV/mock data.
- SKU normalisation: trim + case-insensitive match, display original SKU,
  never group blank SKUs as duplicates.
- Duplicate = COUNT(DISTINCT Variant ID) > 1 for a normalised, non-empty SKU.
- Price Mismatch = Duplicate=Yes AND >1 distinct numeric current price.
- Compare-at Mismatch = Duplicate=Yes AND >1 distinct compare-at state
  (null vs populated counts as different).
- All listings (not just 2) must remain visible/exportable — "Additional
  Listings" count + expandable panel for SKUs with 3+ listings.
- Required table columns, summary cards, filters, CSV export, live
  "Last Checked" timestamp — see full spec text in conversation log.
- User later explicitly supplied a live Shopify Admin API token
  (`shpat_...`) and asked for the page to be live, quick, and finished.

# Owner
Sukirtha

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan

# Queryability Reviewer
Tamil Selvan

# Business Validator
SEO Lead

# Status
Implemented, deployed, live.
