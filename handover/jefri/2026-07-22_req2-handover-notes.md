---
title: Jefri Requirement 2 — Search Terms Labels, handover notes
date: 2026-07-22
type: handover
---

# What shipped
- New "Requirement 2" tab on `pages/jefri.html` — "Search Terms Labels", live PostgreSQL data, last 90 days.
- New API route: `/api/requirement?fn=jefri-search-terms` (in `api/requirement.js`), fully isolated from Req1 (separate pg Pool, separate IIFE, only one shared dispatch-table line added).
- Tag rules finalized same-day after a revision prompt corrected an ambiguity in the original spec:
  - Hero: Clicks ≥ 3 AND ROAS ≥ 400%
  - Villain: Clicks ≥ 3 AND (ROAS < 400% OR Conversions = 0)
  - Zombie: Impressions > 0 AND Clicks = 0
  - Sidekick: Clicks 1–2 AND ROAS ≥ 400%
  - No match: tag left empty

# Where things live
- API: `reports/digital-marketing-member-pages/api/requirement.js` — search for `jefriSearchTermsHandlerModule`.
- UI: `reports/digital-marketing-member-pages/pages/jefri.html` — `div#req2Tab`, JS block prefixed `r2*`.
- Full AIOS trail: `prompts/jefri/2026-07-22_*`, `evidence/jefri/2026-07-22_*`, `validation/jefri/2026-07-22_*`, `reports/jefri/2026-07-22_*`, this file.

# Known open items
1. Not yet committed/pushed to git — pending explicit user permission (repo's standing rule).
2. Not yet synced to the `Staff-requirements` repo (the separate GitHub repo mirrored throughout today's session).
3. No caching/snapshot on this endpoint — every load queries Postgres live for ~50k rows. Fast enough today; revisit if it ever gets slow.
4. Jefri hasn't reviewed the live dashboard yet — the ~47k Zombie count (of 50.7k total terms) is real and expected given how broad "no clicks at all" naturally is across 90 days, but worth a sanity check with him.

# If you're picking this up later
- The tag function is a pure function (`classifyTag`) taking `(clicks, impressions, cost, conversions, roas)` — easy to unit-test in isolation if the rules change again (see the validation file for the exact test harness used).
- Don't reuse Req1's pg Pool for anything new in this file — the isolated-pool pattern here was deliberate so future changes to Req2 (or a hypothetical Req3) can never break Req1.
