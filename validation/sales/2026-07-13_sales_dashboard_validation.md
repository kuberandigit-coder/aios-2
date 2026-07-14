---
title: LEDSone UK Sales Dashboard — Validation
date: 2026-07-13
type: validation
---

# Title
LEDSone UK Sales Dashboard — Validation

# Purpose
Validate the new `sales.html` page and `index.html` roster update
before deployment.

# Business Question
Give staff a directly-hosted sales/attribution dashboard without
depending on the separate iframe deployment.

# Requirement Source
User-provided task spec, 2026-07-13.

# PostgreSQL Sources Checked
Not applicable.

# Shopify Sources Checked
Not applicable to this session's changes (existing webhook pipeline
untouched).

# Checklist

| Item | Result |
|---|---|
| Security: credential rotation confirmed with user before any implementation | ✅ PASS (user confirmed both rotated) |
| No Shopify token / webhook secret copied, echoed, or hardcoded anywhere in this repo | ✅ PASS |
| `sales.html` div-balance check | ✅ PASS (83 open / 83 close) |
| `sales.html` extracted `<script>` — `node --check` | ✅ PASS |
| `google.script.run` calls fully replaced with `fetch()` equivalents (2 call sites: `getAvailableMonths`, `getDashboardData`) | ✅ PASS |
| All existing UI/behavior preserved (15-min countdown, day-filter strip, KPI cards, 5 channel sections, existing customer PII redaction) | ✅ PASS (verbatim reuse of source CSS/markup/JS aside from the 2 fetch changes) |
| `index.html` new roster card added, linking to `pages/sales.html` | ✅ PASS |
| `index.html` header stats/section counts updated (9→10 dashboards, 28→29 live reports) | ✅ PASS |
| `index.html` div-balance check | ✅ PASS (21/21) |
| Apps Script `doGet` change applied and redeployed by user | ❌ NOT DONE YET — snippet handed off, action required from user |
| Live end-to-end test against real `/exec` endpoint | ❌ NOT DONE — blocked on the above |
| Deployed to Vercel | ❌ NOT DONE — awaiting Apps Script redeploy confirmation first |
| Pushed to git | ❌ NOT DONE — explicit push permission not yet given, per task instructions |

# Files Modified
`reports/digital-marketing-member-pages/pages/sales.html` (new),
`reports/digital-marketing-member-pages/index.html`.

# Evidence Location
`evidence/sales/2026-07-13_sales_dashboard_hosted_page_evidence.md`

# Validation Result
Structural/code validation: PASS. Live/functional validation: BLOCKED,
pending the user applying and redeploying the `doGet` change on the
Apps Script side.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Open — build complete, deployment and live verification pending.

# PASS / FAIL
PASS (structural) / PENDING (functional, deployment).

# Next Step
See Next Step list in the evidence file.

---

## Update (appended 2026-07-14) — Final shipped version

The fetch-based approach above was superseded after diagnosing a CORS
blocker (Apps Script responses carry no `Access-Control-Allow-Origin`
header — confirmed via direct `curl -I` header inspection). A serverless
proxy (`api/sales-proxy.js`) was built and verified working, then the
user chose a simpler final approach: replace `sales.html` with a plain
iframe embed of the Apps Script `/exec` URL (matching the pre-existing
separate iframe deployment's proven pattern).

| Item | Result |
|---|---|
| CORS root cause diagnosed (missing `Access-Control-Allow-Origin`) | ✅ CONFIRMED via `curl -I` |
| Serverless proxy built and tested | ✅ PASS (reached Apps Script correctly; superseded, not shipped) |
| Final iframe-based `sales.html` — structural check | ✅ PASS (div-balance clean) |
| Deployed to Vercel production | ✅ PASS — verified live via curl (200 OK, iframe present) |
| `index.html`: roster-card approach reverted per user request | ✅ DONE — replaced with a compact button next to the search bar ("ledsone.co.uk", 42px height matching the search input), themed like the existing member cards |
| Pushed to git | ❌ still not done — pending explicit permission |

# Validation Result (final)
PASS — final iframe-based version deployed and confirmed live. Only
outstanding item is the git push, withheld pending explicit user
permission per task instructions.
