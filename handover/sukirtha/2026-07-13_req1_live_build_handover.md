---
title: Sukirtha Req1 — Live Build Handover
date: 2026-07-13
type: handover
---

# Title
Sukirtha Requirement 1 — Live Dashboard Build Handover

# Purpose
Hand over the completed implementation for future maintenance/reference.

# Business Question
Which blog posts and collection pages on ledsone.de have a CTR below 1.5%
during the last 6 months and should be prioritised for SEO optimisation?

# Requirement Source
Sukirtha Requirement 1 (business requirement provided 2026-07-13).

# PostgreSQL Sources Checked
None used in final build — GSC-only per instruction (see discovery
handover for the Postgres sources checked earlier).

# Shopify Sources Checked
Not applicable.

# Completed
- Live GSC dashboard built and deployed:
  `pages/sukirtha.html` + `api/gsc-sukirtha-low-ctr.js`.
- Uses the same `GSC_SERVICE_ACCOUNT_KEY` Vercel env var already set up
  for Kamsi's live dashboard — no new secret needed.
- Access to `ledsone.de` GSC property granted mid-session by the user
  (Restricted permission for `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`).
- Freshness improved (dataState:'all') in the same pass, applied to both
  this and Kamsi's live dashboard.
- `index.html` updated: Sukirtha moved to Active Dashboards.
- Both repos (`aios-2`, `Staff-requirements`) and production verified in
  sync.

# Remaining Work
None outstanding for this requirement. Full spec delivered.

# Risks / Assumptions
- Site property used is `https://ledsone.de/` (URL-prefix property), not
  a domain property — confirmed this is what the granted access actually
  covers via `sites.list`. If ledsone.de is later reconfigured as a
  domain property in GSC, the `SITE_URL` constant in
  `api/gsc-sukirtha-low-ctr.js` would need updating to match.
- Same 5-minute response cache (`s-maxage=300`) as Kamsi's dashboard, for
  GSC quota protection — not literally live on every single request
  within that window, but always reflects current GSC data across
  requests spaced further apart.
- CTR threshold (1.5%) is hardcoded per this specific requirement —
  intentionally different from Kamsi's Req2 threshold (2%), not a bug if
  someone compares the two files side by side.

# Next Action
Await Sukirtha/SEO team review of the live dashboard. No further
technical work required unless feedback requests changes.
