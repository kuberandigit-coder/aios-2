---
title: SUK-R4 — Deployment Readiness
requirement_id: SUK-R4
type: deployment
---

# Title
SUK-R4 — Deployment Readiness Notes

# Requirement ID
SUK-R4

# Purpose
Record deployment configuration and status for the SUK-R4 live endpoint.

# GA4 Property
`462018160`

# GSC Property
`https://ledsone.de/`

# Environment Variables (Vercel production)
- `GA4_PROPERTY_ID` = `462018160` — added with explicit user approval.
- `GA4_SERVICE_ACCOUNT_JSON` = full service-account key JSON
  (`aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, read-only
  `analytics.readonly` + `webmasters.readonly` scopes) — added with
  explicit user approval after the user asked what risk this carries;
  answered (Sensitive/encrypted var, server-side only, read-only scope
  limits blast radius) before upload.

# Deployment Method
`npx vercel --prod` from `reports/digital-marketing-member-pages/` —
same linked project as SUK-R1/R2/R3 (`digital-marketing-member-pages`,
org `digitalmarketing69140951-sys-projects`). User explicitly approved
this deploy in chat, overriding the requirement's default "Do not
deploy to Vercel" instruction.

# Endpoint
`https://digital-marketing-member-pages.vercel.app/api/sukirtha-req4-ga4-seo`
— confirmed HTTP 200 with real data (869 landing pages, 8,016 queries)
immediately after deploy.

# Regression Check
Post-deploy, re-tested R1/R2/R3 endpoints — all HTTP 200, no regression.

# Status
**Deployed** — live in production as of 2026-07-14.

# Known Limitations
n/a beyond what's noted in `reports/sukirtha/SUK-R4-completion-report.md`.

# Duplicate-Truth Risk
LOW — see `evidence/sukirtha/SUK-R4-ga4-gsc-source-map.md`.

# Parent AIOS Candidate Status
Not applicable.

# Next Step
Git commit/push to `aios-2` and `Staff-requirements` still requires
separate written approval, per standard AIOS rule (matches how SUK-R2/
R3 were handled).

# PASS / FAIL
PASS — deployed and live-verified 2026-07-14.
