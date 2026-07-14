---
title: SUK-R4 — Handover
requirement_id: SUK-R4
type: handover
---

# Title
SUK-R4 — Core GA4 Data for SEO — Handover

# Requirement ID
SUK-R4

# Purpose
Continuation context for any future session picking up SUK-R4-related
work.

# Business Question
Which landing pages on ledsone.de receive Organic Search traffic, how
are users engaging with those pages, and what search queries generate
that traffic during the last 30 days?

# GA4 Property
`462018160` (ledsone.de) — confirmed live 2026-07-14 by the user
locating it in GA4 Admin → Property → Property details, then verified
programmatically (top hostname `ledsone.de`, 26,378 sessions/30d).

# GSC Property
`https://ledsone.de/` — reused SUK-R1's existing grant.

# What Was Built
- New serverless endpoint
  `reports/digital-marketing-member-pages/api/sukirtha-req4-ga4-seo.js`
  — authenticates to Google via a manually-signed RS256 JWT (no
  `googleapis` npm dependency), calls GA4 `runReport` (Organic Search
  filter, last 30 days) and GSC `searchAnalytics.query` (last 30 days),
  joins them by normalized landing-page path, computes Page Type from
  the URL path, and returns summary + rows.
- New Requirement 4 tab added to
  `reports/digital-marketing-member-pages/pages/sukirtha.html` —
  matches the Req2/Req3 UX pattern: IndexedDB caching (fetch once per
  tab-open, Refresh button for a live re-fetch), sortable/paginated
  table with sticky header, filters, CSV export.
- `index.html` counts synced: Sonya 5, Sukirtha 4 report cards, "Live
  Reports" total → 33.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req4-ga4-seo.js`,
`reports/digital-marketing-member-pages/index.html`.

# Vercel Env Vars Added
`GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON` — both added to
production with explicit user approval (asked twice: once to confirm
the write itself, once when the user asked what risk it carries).

# Deployment
Deployed to Vercel production 2026-07-14, user-approved. Endpoint
confirmed live (869 landing pages, 8,016 queries, €866.74 revenue).
R1–R3 re-tested and unaffected.

# Not Yet Done
Git commit/push to `aios-2` (GitHub) and `Staff-requirements` — both
still require separate written approval, matching how SUK-R2/R3 were
handled this session.

# Evidence
`evidence/sukirtha/SUK-R4-ga4-gsc-source-map.md`

# Validation
`validation/sukirtha/SUK-R4-validation-report.md` — 15/15 PASS.

# Owner
Sukirtha

# Reviewer
Sajeesan / Tamil Selvan — pending

# Status
Built and deployed live. Awaiting git push approval.

# PASS / FAIL
PASS

# Next Step
If the user asks to push this to git, follow the same flow used for
SUK-R3: commit to `kuberan-web` (aios-2), then separately sync the
changed files (`sukirtha.html`, `sukirtha-req4-ga4-seo.js`, `index.html`
if not already synced) into a fresh clone of `Staff-requirements` and
push there directly — do not use `git subtree push` (it fights with
unrelated phantom gitlinks `EOD`/`Blog tool` in the kuberan-web repo
root; a fresh-clone-and-copy is the proven working method, see
[[feedback_deploy_from_git_workflow]] for the reverse-direction
version of this pattern).
