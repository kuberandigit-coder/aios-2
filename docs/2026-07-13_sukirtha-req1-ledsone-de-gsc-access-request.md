---
title: Sukirtha Requirement 1 — Request GSC Access Grant for ledsone.de
date: 2026-07-13
type: access-request
status: pending
---

# Title
Request to grant service-account access to the `ledsone.de` Google Search
Console property, to unblock Sukirtha Requirement 1 (Low CTR Blog Posts &
Collections Identification).

# Purpose
Sukirtha Req1 requires a genuine last-6-months CTR analysis for
`ledsone.de` blog posts and collection pages. Neither approved data source
can currently produce this:
- PostgreSQL (`ledsone-db`, schema `google_search_console`) only has
  history back to 2026-03-20 (~3.7 months) — confirmed as the **full
  source history**, not a sync gap, per
  `ledsone-aios-knowledge-base` (`database/postgresql/schemas/google_search_console/README.md`).
- The live GSC API service account
  (`aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`) currently has
  access to **only** `sc-domain:ledsone.co.uk` — confirmed via a direct
  `sites.list` API call on 2026-07-13, which returned exactly one property.
  It has **zero access to `ledsone.de`**.

# Business Question
Which blog posts and collection pages on ledsone.de have a CTR below 1.5%
during the last 6 months and should be prioritised for SEO optimisation?

# Requirement Source
Sukirtha Requirement 1 (business requirement provided 2026-07-13).

# PostgreSQL Sources Checked
- `ledsone-db` — schema `google_search_console`, table `page`. Confirmed
  232,533 rows for `site_url = 'https://ledsone.de/'`, date range
  **2026-03-20 to 2026-07-10 only**. 2,493 distinct collection pages,
  187 distinct blog pages confirmed present in this window.
- `ledsone-aios-knowledge-base` — confirmed via
  `database/postgresql/schemas/google_search_console/README.md` that
  2026-03-20 is the full available source history (one-time backfill
  completed 2026-07-10; daily sync only keeps a rolling 10-day window
  current from that point forward — there is no older data to backfill).

# Shopify Sources Checked
Not applicable — this requirement is GSC-only (impressions/clicks/CTR/
position), no Shopify product/order data involved.

# What we need
Whoever administers the `ledsone.de` Google Search Console property to add
this service account as a user (same one-time step already completed for
`ledsone.co.uk` on 2026-07-03):

- **Service account email**: `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`
- **Property**: `ledsone.de` (Domain property, likely `sc-domain:ledsone.de`)
- **Access level needed**: Restricted (read-only) is sufficient — same
  level already granted for `ledsone.co.uk`.
- **Steps** (Search Console → Settings → Users and permissions → Add
  user → paste the service account email → Restricted).

# Files Modified
None yet — this is a blocking discovery finding, no implementation started
pending this access grant (or an explicit decision to proceed with the
~3.7-month Postgres range instead).

# Evidence Location
`evidence/sukirtha/2026-07-13_req1_discovery_and_gsc_access_gap_evidence.md`

# Validation Result
See `validation/sukirtha/2026-07-13_req1_discovery_validation.md` —
6-month-range requirement currently **FAIL** (blocked), all other
readiness checks **PASS**.

# Owner
Kuberan (AIOS) / Claude Code session, on behalf of Sukirtha's requirement.

# Reviewer
Whoever administers the `ledsone.de` Search Console property (unknown at
time of writing — same person/team who granted `ledsone.co.uk` access on
2026-07-03 is the most likely contact).

# Status
Pending — access grant requested, not yet actioned.

# PASS / FAIL
FAIL (blocked) for the literal "last 6 months" requirement. PASS for all
other readiness checks (no duplicate page, data structure confirmed,
sufficient volume once access/range is available).

# Next Step
1. Send this request to the `ledsone.de` GSC property administrator.
2. Once granted, re-run the `sites.list` check to confirm access, then
   query `searchAnalytics.query` directly for a true 6-month window
   (`/collections/`, `/blogs/`, `/blog/` scope) and proceed with building
   `sukirtha.html` per the full requirement.
3. If access cannot be granted promptly, revisit the alternative
   (build now with the available ~3.7-month Postgres range, clearly
   labeled) as a fallback — not yet authorized, since the user chose to
   request access first.

---

## Resolution (appended 2026-07-13, same day)

**RESOLVED.** User granted the service account access to `ledsone.de` in
Google Search Console (Restricted permission), confirmed via screenshot.
Verified programmatically immediately after — `sites.list` now returns
`https://ledsone.de/` alongside the pre-existing `sc-domain:ledsone.co.uk`
grant. A true 6-month window was confirmed available (183 days of real
data, 2026-01-09 to 2026-07-10 at verification time).

Implementation proceeded on this basis — see
`evidence/sukirtha/2026-07-13_req1_live_dashboard_build_evidence.md` and
`closure/sukirtha/2026-07-13_req1_closure.md` for the completed build.

Status updated: ~~pending~~ → **resolved**.
