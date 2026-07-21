---
title: Vercel deployment notes — Mahima/Jeffri/FR onboarding/Thasitha tabs, race-condition fix
date: 2026-07-21
type: vercel-notes
---

# Project
`digital-marketing-member-pages` (team `digitalmarketing69140951-sys-projects`), directory `reports/digital-marketing-member-pages`.

# Deployments this block
Multiple `vercel deploy --prod --yes` runs from the local working directory, each verified live via direct `curl` against `https://digital-marketing-member-pages.vercel.app/api/sales-sukirtha-de?...` after deploying — order counts and gross sales spot-checked per staff/month after each meaningful code change (new staff branch, race-condition fix, snapshot regeneration).

# Environment variables touched
- **Added**: `SHOPIFY_FR_ADMIN_TOKEN` (Sensitive, Production) — new for ledsone.fr onboarding. Token was pasted in chat by the user and stored directly via `vercel env add`, piped via stdin, never written to any file.

# Function count check
Verified before deploying (Vercel Hobby plan 12-function cap): held at 11 `.js` files under `api/` + `api/jefri/product-status.js` = 12, throughout this block — no new serverless function files were created; all new logic went into the existing merged `sales-sukirtha-de.js` and the FR store was added via parameter overrides, not a new file.

# Known issue surfaced later the same day
This project auto-deploys from a connected GitHub repo (`Staff-requirements`) independent of these manual CLI deploys — not an issue during this block, but caused a production outage during the next block (see that block's own vercel-notes file).
