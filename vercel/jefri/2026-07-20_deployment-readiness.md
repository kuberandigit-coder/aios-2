---
title: Jefri Requirement 1 — Deployment Readiness
requirement_id: JEFRI-R1
date: 2026-07-20
status: BUILT, NOT DEPLOYED — blocked on missing DATABASE_URL and Vercel function-count cap
---

## Purpose
Deployment readiness check for Jefri Requirement 1 (Product Status Labels).

## Team member / Department / Store
Jefri / Google Ads / ledsone.de

## Readiness
Code complete and self-validated against the requirement's own 4 example
cases (all PASS — see `validation/jefri/2026-07-20_validation-results.md`).
SQL join logic and identifier mapping tested against real live rows via
the project's existing read-only PostgreSQL connection.

Not yet done before a real deploy can succeed:
1. `DATABASE_URL` (or `PGHOST`/`PGUSER`/`PGPASSWORD`) is not set in the
   `digital-marketing-member-pages` Vercel project. Claude Code cannot set
   this itself (credential-handling rule) — Kuberan must run
   `vercel env add DATABASE_URL production` himself.
2. The project is already at Vercel's Hobby-plan cap of 12 serverless
   functions. Deploying `api/jefri/product-status.js` would be the 13th
   and will fail deployment until either the plan is upgraded or an
   existing function is merged/retired (requires sign-off — not done
   unilaterally per "do not modify unrelated staff pages").
3. Confirm whether `ledsone-db-mcp`'s underlying database (name `ledsone`)
   is the same server as the requirement's literal `postgres`@`207.148.78.148`
   spec, or a different one that needs independent schema verification.

## Deployment status
NOT DEPLOYED.

## Git push status
NOT PUSHED — new/modified files exist locally only, pending user confirmation to commit.

## Next step
Kuberan resolves the two blockers above, then: commit, push to
`github.com/kuberandigit-coder/aios-2`, then `vercel --prod` from
`reports/digital-marketing-member-pages/`, then update this file with the
resulting commit hash and deployment URL.
