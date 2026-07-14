---
title: SUK-R2 — Deployment Readiness
requirement_id: SUK-R2
type: vercel
---

# Title
SUK-R2 — Deployment Readiness Notes

# Requirement ID
SUK-R2

# Purpose
Record deployment configuration for the live SUK-R2 endpoint.

# Requirement Source
`prompts/sukirtha/SUK-R2-duplicate-listing-price-check-prompt.md`

# Business Question
n/a (deployment record)

# Shopify Store
ledsone.de

# Shopify Objects and Fields Checked
n/a — this file documents deployment, not Shopify schema.

# Vercel Project
`digitalmarketing69140951-sys-projects/digital-marketing-member-pages`
(project ID `prj_ziowoLxTbIReqBYx1zVweZZBaBDg`).

# Environment Variable
`SHOPIFY_ADMIN_TOKEN` — set as Production, type Sensitive, via
`vercel env add` (value never echoed to any log or file; user supplied it
directly in chat and explicitly directed it be stored this way after an
auto-mode safety check required confirmation). Scope: `read_products`-level
Shopify Admin API access token for `ledsone-de.myshopify.com`.

# Endpoint
`reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`
— Vercel serverless function, paginated read-only Admin GraphQL calls
against `https://ledsone-de.myshopify.com/admin/api/2024-10/graphql.json`.
CORS: `Access-Control-Allow-Origin: *` set on the response (matches the
existing `api/gsc-sukirtha-low-ctr.js` pattern already live on this page).

# Production URL
`https://digital-marketing-member-pages.vercel.app/pages/sukirtha.html`
(Requirement 2 tab). API tested directly:
`https://digital-marketing-member-pages.vercel.app/api/sukirtha-req2-duplicate-check`
→ 200 OK, summary matches offline bulk-pull exactly.

# Deployment Method
`vercel --prod` from
`reports/digital-marketing-member-pages/` — aliased to the existing
production domain, no new project created.

# Files Modified
`reports/digital-marketing-member-pages/pages/sukirtha.html`,
`reports/digital-marketing-member-pages/api/sukirtha-req2-duplicate-check.js`

# Evidence Location
`evidence/sukirtha/SUK-R2-shopify-source-map.md`

# Validation Result
PASS — see `validation/sukirtha/SUK-R2-validation-report.md`, item 22
("No Shopify credentials exposed" — confirmed absent from client-facing
files).

# Owner
Kuberan (AIOS) / Claude Code session

# Coordinator
Kuberan

# Technical Reviewer
Sajeesan — pending

# Queryability Reviewer
Tamil Selvan — pending

# Business Validator
SEO Lead — pending

# Status
Deployed to production, live.

# Known Limitations
Token was pasted in plain chat by the user before being moved to the
Vercel secret store — recommend the store owner consider rotating this
token as routine hygiene, independent of this task's own handling (which
never wrote it to any file or log).

# Duplicate-Truth Risk
n/a — deployment record only.

# Parent AIOS Candidate Status
Not applicable.

# Next Step
None required for deployment; git push to GitHub (separate from this
Vercel deploy) still needs explicit approval.

# PASS / FAIL
PASS
