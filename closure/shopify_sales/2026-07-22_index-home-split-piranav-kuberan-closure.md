---
title: Directory Restructure — index.html/home.html Split closure
date: 2026-07-22
type: closure
---

# Title
Closure — index.html/home.html directory split, Piranav + Kuberan landing cards (2026-07-22).

# Purpose
Close out this restructure with a clear record of what shipped and what's still open.

# Completed & Deployed
- Original member roster moved from `index.html` to `home.html`, trimmed to 6 members (Jefri, Dilaksi, Kamsi, Mahima, Thasitha, Sukirtha), header/section counts corrected (12→6 members, 39→21 live reports).
- New `index.html` built as a two-card landing page (Kuberan → `home.html`, Piranav → external `staff-requirements-02.vercel.app`), same visual design, with the `ledsone.co.uk` quick-link to `pages/sales.html` retained.
- Proactively found and fixed all 18 staff pages' "Back to all members" links, which would otherwise have pointed at the new two-card chooser instead of the actual roster.
- Deployed to Vercel production; both `/` and `/home.html` verified live (HTTP 200).

# Remaining Work
1. Git commit/push not yet done — pending explicit user permission per repo's standing rule.
2. Confirm with user whether the 6 members removed from `home.html` (Hetheesha, Sonya, Thivajini, Jakshan, Sajeepan, Theekshy) need any other entry point, since they're currently only reachable via the Sales dashboard tabs, not this directory.

# Files Modified
See evidence file: `evidence/shopify_sales/2026-07-22_index-home-split-piranav-kuberan-evidence.md`.

# Evidence Location
`evidence/shopify_sales/2026-07-22_index-home-split-piranav-kuberan-evidence.md`

# Validation Result
PASS — both pages live-verified, zero stale back-links remaining.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, closed pending git push permission.

# PASS / FAIL
PASS

# Next Step
1. Confirm with user whether to git commit/push today's work.
2. Confirm scope decision on the 6 removed members' visibility.
