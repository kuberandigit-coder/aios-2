---
title: Vercel deployment notes — Gross Sales fix, reassignment, outage recovery
date: 2026-07-21
type: vercel-notes
---

# Project
`digital-marketing-member-pages` (team `digitalmarketing69140951-sys-projects`), directory `reports/digital-marketing-member-pages`.

# Production outage and recovery (the notable event this block)
- **Symptom**: user-reported error on the live site — "Failed to execute 'json' on 'Response': Unexpected token 'T', 'The page c'... is not valid JSON" on Thivagini's tab.
- **Diagnosis**: `vercel inspect https://digital-marketing-member-pages.vercel.app --logs` on the currently-aliased deployment showed:
  ```
  Cloning github.com/digitalmarketing69140951-sys/Staff-requirements (Branch: main, Commit: 685c400)
  ```
  — an entirely different, older codebase (function names like `sukirtha-req2-duplicate-check`, `gsc-low-ctr`, none matching our actual `api/` folder). This deployment had gone live ~6 minutes before the user's report, silently replacing our correct CLI-deployed build. Root cause traced separately (outside this AIOS scope) to an automated daily GitHub Actions workflow in that connected repo, unrelated to any manual edit here.
- **Fix**: immediately ran `vercel deploy --prod --yes` from the correct local directory again; verified restored via `curl .../api/sales-sukirtha-de?staff=kamsi&month=2026-01` returning HTTP 200 with the correct payload structure.
- **Status**: resolved for this incident, but the underlying trigger (GitHub auto-deploy connection) is still active and can recur — flagged to the user, no action taken yet on disconnecting it.

# Other deployments this block
Multiple further `vercel deploy --prod --yes` runs for: adding `taxLines` to the GraphQL query, the discount-reconciliation fix, the Order Total card, the 41-order reassignment, and several temporary diagnostic query flags. Each verified live via direct `curl` before and after.

# Environment variables touched
- **Rotated twice**: `SHOPIFY_UK_ADMIN_TOKEN` (Sensitive, Production) — user provided two successive new tokens during troubleshooting of a separate, unrelated 60-day order-history limitation on a different tab; both were stored via `vercel env rm` + `vercel env add`, piped via stdin, never written to any file. (Full context of that investigation is intentionally not detailed further in AIOS documentation per explicit user instruction.)

# Function count check
Held at 11 `.js` files under `api/` + `api/jefri/product-status.js` = 12 throughout this block — verified via `find api -name "*.js"` before each deploy.

# Data regenerated this block
Snapshot files fetched live from Shopify and written to `api/data/`: `hetheesha-fr-organic-sales-2026-0{1-6}.json` (new), `thivagini-fr-ads-sales-2026-0{1-6}.json` (new), `thasitha-de-ads-sales-2026-0{1-6}.json` (01-04 regenerated with the fix, 05-06 newly generated).
