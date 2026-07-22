---
title: API Consolidation — 15 Serverless Functions Down to 2 (sales.js + requirement.js)
date: 2026-07-22
type: evidence
---

# Title
Consolidated all 15 API files in `reports/digital-marketing-member-pages/api/` down to 2 — `sales.js` (all sales.html-related endpoints) and `requirement.js` (all other requirement-page endpoints) — well under Vercel Hobby plan's 12-serverless-function limit that had just caused a failed auto-deploy.

# Purpose
A push to the connected `Staff-requirements` GitHub repo (investigated earlier today) failed to auto-deploy because the merged codebase had grown to 15 API files, exceeding Vercel's Hobby-plan 12-function cap. User asked to consolidate further, in two explicit steps.

# Business Question
Can all of this project's serverless functions be reduced to a small, stable number so future pushes (including from Piranav, who has push access to the connected repo) don't risk failing or breaking the 12-function limit again?

# Requirement Source
Live user instructions, two rounds:
1. "can you add these also in sales-sukirtha-de.js and rename that file to sales.js ?" (with screenshots showing `sales-dilaksi.js`, `sales-jackson.js`, `sales-kamsi.js`, `sales-sukirtha-uk.js`) — merge those 4 into `sales-sukirtha-de.js`, rename result to `sales.js`.
2. "sukirtha-req4-ga4-seo.js , sukirtha-req2-req3.js , kamsi-live.js , check-urls.js can you merge these and add into gsc-ctr.js here ? and rename the file name to requirment.js" — merge those 4 into `gsc-ctr.js`, rename to `requirement.js`.
3. "tell me in jefri product-status.js can add into also requirment.js because i am going to maintain all sales.html js into sales.js and requirment page in to requirment.js" — folded the last remaining file (`jefri/product-status.js`) into `requirement.js` too, per the user's stated end-goal: exactly 2 files total, split by which page's logic they serve.

# Implementation

## Root problem discovered
Each of the original files independently declared identically-named top-level helpers (`STORE_DOMAIN`, `TOKEN`, `sleep`, `shopifyGraphQL`, `base64url`, `getAccessToken`, `resolveReportMonth`, `classifySession`, etc.) — a naive text concatenation would immediately throw `SyntaxError: Identifier has already been declared`.

## Merge technique
Wrote a small Node script (not manual editing, given ~4,600+ combined lines across the two merges) that, for each source file:
1. Reads its full content.
2. Renames its `module.exports = async function handler(req, res) { ... }` (or the ESM `export default async function handler` variant found in `sukirtha-req2-req3.js` / `sukirtha-req4-ga4-seo.js`) to a uniquely-named local function.
3. Wraps the entire file's content in its own IIFE — `const xHandlerModule = (function() { ...entire original file... ; return xHandler; })();` — isolating every top-level `const`/`function` declaration into that closure's private scope.
4. Inserts the wrapped module into the target base file, right after its `require()` lines.
5. Adds dispatch logic at the top of the base file's own exported handler: a new query param (`entity=` for `sales.js`, `fn=` for `requirement.js`) routes to the matching wrapped handler; no param falls through to the base file's own original logic unchanged (preserving all of `sales.html`'s existing `?staff=...` calls with zero URL change).

## sales.js (merge round 1)
- Base: `sales-sukirtha-de.js` (2,045 lines, already handles ~9 different staff via `?staff=`).
- Merged in: `sales-dilaksi.js`, `sales-jackson.js`, `sales-kamsi.js`, `sales-sukirtha-uk.js` (792+452+780+549 lines).
- Dispatch: new `?entity=dilaksi|jackson|kamsi|sukirtha-uk` param; default (no `entity`) preserves all existing `?staff=...` behavior unchanged.
- Result: 4,642 lines, one file.

## requirement.js (merge round 2 + follow-up)
- Base: `gsc-ctr.js` (246 lines, already handles `?store=uk|de`).
- Merged in: `check-urls.js`, `kamsi-live.js`, `sukirtha-req2-req3.js`, `sukirtha-req4-ga4-seo.js`, then `jefri/product-status.js`.
- Dispatch: new `?fn=check-urls|kamsi-live|req2-req3|req4-ga4-seo|jefri-product-status` param; default (no `fn`) preserves existing `?store=uk|de` gsc-ctr behavior unchanged.
- One bug caught and fixed during the URL rewrite: `jefri.html`'s `campaignParam` was building a second `?campaign=...` query string, which would have produced an invalid double-`?` URL (`/api/requirement?fn=jefri-product-status?campaign=...`) — changed to `&campaign=...`.
- Result: 2,005 lines, one file.

## Testing before deploy
For both merges, before touching any HTML or deploying: ran `node --check` for syntax validity, then executed the merged module directly in Node with a mock `req`/`res` for every dispatched entity/fn value, confirming each one reaches its own real logic (distinguishable by each returning its own distinct, correct env-var-missing error — e.g. `sajeepan-ads` → `SHOPIFY_ADMIN_TOKEN missing`, `kamsi` entity → `SHOPIFY_UK_ADMIN_TOKEN missing`) rather than a collision error or wrong-handler routing.

## HTML updates
Rewired every caller across `sales.html`, `jackson-sales.html`, `dilaksi.html`, `kamsi-req1-slow-moving-products.html`, `kamsi-req2-low-ctr-pages.html`, `kamsi-req3-core-ga4-seo.html`, `sukirtha.html`, `jefri.html` to the new consolidated URLs, verified via grep that zero old endpoint references remained after each round.

## vercel.json
Updated `functions` block twice as files were removed/renamed, ending at just `api/sales.js` and `api/requirement.js`.

# Files Modified
- **Created**: `api/sales.js`, `api/requirement.js`
- **Deleted**: `api/sales-dilaksi.js`, `api/sales-jackson.js`, `api/sales-kamsi.js`, `api/sales-sukirtha-uk.js`, `api/sales-sukirtha-de.js`, `api/check-urls.js`, `api/kamsi-live.js`, `api/sukirtha-req2-req3.js`, `api/sukirtha-req4-ga4-seo.js`, `api/gsc-ctr.js`, `api/jefri/product-status.js` (11 files removed)
- **Updated**: `vercel.json`, and the 8 HTML pages listed above
- **Bug fixed in passing**: `jefri.html`'s campaign-filter query string concatenation

# Evidence Location
This file.

# Validation Result
- `node --check` passed on both merged files.
- Local dispatch test (mock req/res) confirmed all 10 total entity/fn routes reach correct, distinct logic.
- Live post-deploy verification: `staff=sajeepan-ads`, `entity=kamsi` (both via `sales.js`), and `fn=jefri-product-status`, default `store=uk` (both via `requirement.js`) all returned HTTP 200 with correct data/expected behavior.
- Final API file count: **15 → 2**.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, verified live and healthy.

# PASS / FAIL
PASS

# Next Step
1. Sync this consolidation to the connected `Staff-requirements` GitHub repo (same manual sync process used earlier today), so the next auto-deploy from that repo doesn't regress back to 15 files.
2. Git commit/push in the main `aios-2` repo — pending explicit user permission per repo's standing rule.
