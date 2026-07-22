---
title: API Consolidation 15 -> 2 Files closure
date: 2026-07-22
type: closure
---

# Title
Closure — API consolidation from 15 serverless functions down to 2 (2026-07-22).

# Purpose
Close out this consolidation with a clear record of what shipped and what's still open.

# Completed & Deployed
- Merged 13 of 15 API files into 2: `sales.js` (all sales.html logic, dispatched via `?entity=` or existing `?staff=`) and `requirement.js` (everything else, dispatched via `?fn=` or existing `?store=`).
- Used a scripted IIFE-wrapping technique to safely merge files with colliding top-level identifiers, rather than risky manual text merging.
- Tested every dispatch route locally (syntax check + mock invocation) before touching any HTML or deploying.
- Rewired all 8 affected HTML pages to the new URLs; caught and fixed one query-string concatenation bug in `jefri.html` during the process.
- Deployed to Vercel production; live-verified across both files.

# Remaining Work
1. `Staff-requirements` (the connected GitHub repo) still has the old 15-file structure — needs the same manual sync process used earlier today, or the next auto-deploy from that repo will silently revert this consolidation.
2. Git commit/push in `aios-2` not yet done — pending explicit user permission per repo's standing rule.

# Files Modified
See evidence file: `evidence/shopify_sales/2026-07-22_api-consolidation-15-to-2-files-evidence.md`.

# Evidence Location
`evidence/shopify_sales/2026-07-22_api-consolidation-15-to-2-files-evidence.md`

# Validation Result
PASS — syntax valid, all dispatch routes tested locally and live, zero stale URL references remaining.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, closed pending git push permission and Staff-requirements sync.

# PASS / FAIL
PASS

# Next Step
1. Sync consolidation to Staff-requirements repo.
2. Confirm with user whether to git commit/push today's work in aios-2.
