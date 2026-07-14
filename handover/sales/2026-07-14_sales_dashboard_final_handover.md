---
title: LEDSone UK Sales Dashboard — Final Handover
date: 2026-07-14
type: handover
---

# Title
LEDSone UK Sales Dashboard — Final Handover

# Purpose
Hand over the completed sales dashboard hosting task.

# Business Question
Give staff a directly-hosted sales/attribution dashboard.

# Requirement Source
User-provided task spec, 2026-07-13 (original spec asked for a
fetch-based rebuild of the existing Apps Script dashboard; final shipped
approach is a simpler iframe embed, per user decision after a CORS
blocker was diagnosed — see evidence file for full history).

# PostgreSQL Sources Checked
Not applicable.

# Shopify Sources Checked
Not applicable — this task never touched the existing webhook/order-sync
pipeline (`code.gs`), only the dashboard-viewing layer.

# Completed
- Confirmed Shopify Admin API token + webhook shared secret rotation
  with the user before any implementation (per explicit security
  instruction).
- Never hardcoded either credential anywhere in this repo.
- Built and validated a fetch-based `sales.html` rewrite + `doGet` JSON
  action snippet (handed to user for `dashboard.gs`) — this hit a real
  CORS blocker (Apps Script sends no `Access-Control-Allow-Origin`
  header), diagnosed via direct `curl -I` header inspection.
- Built and verified a serverless CORS proxy
  (`api/sales-proxy.js`) as a fix for that blocker — confirmed working
  (reached Google's servers correctly).
- User then chose the simpler final approach: `sales.html` is now a
  plain iframe embed of the Apps Script `/exec` URL — no `doGet`
  changes, no fetch rewrite, no proxy needed. `api/sales-proxy.js`
  removed from disk as no longer used.
- `index.html`: added, then reverted per user request, a full roster
  card; final version is a compact button next to the search bar
  ("ledsone.co.uk"), height-matched (42px) to the search input, styled
  in the site's existing member-card visual language (navy/gold avatar
  circle).
- Both files deployed to Vercel production, confirmed live via curl.

# Remaining Work
- **Git push** — not yet done. This session will `git add`/commit
  locally per the CLAUDE.md auto-save rule; push requires explicit user
  confirmation per the original task's instruction.
- The original fetch-based `sales.html` + `doGet` JSON-action approach
  is fully abandoned for now — if a genuinely standalone (non-iframe)
  hosted dashboard is wanted later, that work (the `doGet` snippet and
  `api/sales-proxy.js` pattern) is preserved in the evidence file and
  could be revived, but isn't part of what's live today.
- The existing separate iframe deployment
  (`C:\Users\PC\OneDrive\Desktop\Sales Dashboard`, Vercel repo
  `kuberandigit-coder/Sales-dashboard`) still exists independently and
  was never touched by this task — there are now two iframe wrappers
  pointing at the same Apps Script URL (the old standalone one, and the
  new one inside this member-pages site). Worth flagging to the user in
  case one should eventually be retired.

# Files Modified
`reports/digital-marketing-member-pages/pages/sales.html` (final:
iframe embed), `reports/digital-marketing-member-pages/index.html`
(button next to search bar).

# Evidence Location
`evidence/sales/2026-07-13_sales_dashboard_hosted_page_evidence.md`

# Validation Result
PASS — see `validation/sales/2026-07-13_sales_dashboard_validation.md`
(final section, appended 2026-07-14).

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed, closed pending git push permission.

# PASS / FAIL
PASS

# Next Step
Confirm with user whether to git push now, and whether the older
standalone `Sales-dashboard` Vercel deployment should be retired now
that this page exists inside the main member-pages site.
