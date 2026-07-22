---
title: Directory Restructure — index.html/home.html Split, Piranav + Kuberan Landing Cards
date: 2026-07-22
type: evidence
---

# Title
`reports/digital-marketing-member-pages/index.html` restructured into a two-workspace landing page (Piranav / Kuberan name cards), with the original member roster moved to `home.html` and trimmed to 6 members.

# Purpose
User wanted a top-level landing page separating two people's dashboards (Piranav's separate Vercel project, Kuberan's existing member directory), rather than one long roster mixing everyone.

# Business Question
Can Piranav and Kuberan each get a single clean entry point to their own dashboards from one shared root URL?

# Requirement Source
Live user instruction: "need to change current index.html to home.html and create a new index.html for two name card one is piranav and others are kuberan , so in home.html show only mahima , thasitha , jeffri , kamsi , dilaski , sukirtha remove others and for pirnav card add direct link to his dashboard that dashboard link is https://staff-requirements-02.vercel.app/ i need this index.html also same design and remove update the home.html dashboard counts in headers and report counts in name card also correct and in new index.html need ledsone.uk button also to navigate sales.html"

# Implementation
- Copied the original `index.html` (12-member roster) to `home.html` unchanged in design.
- Trimmed `home.html`'s roster to 6 members: Jefri, Dilaksi, Kamsi, Mahima, Thasitha, Sukirtha — removed Hetheesha, Sonya, Thivajini, Jakshan, Sajeepan, Theekshy from this page (they remain reachable via the Sales dashboard's own tabs, just not listed here).
- Corrected `home.html`'s header stat counts to match the trimmed roster: Members 12→6, Active Dashboards 12→6, Live Reports 39→21 (sum of the 6 remaining members' own report counts: Jefri 1 + Dilaksi 3 + Kamsi 6 + Mahima 3 + Thasitha 4 + Sukirtha 4 = 21), section-title count 11→6, Updated date → 2026-07-22.
- Rewrote `index.html` as a new landing page, same visual system (masthead, navy/gold palette, card styling) reused from the original file — two large name cards:
  - **Kuberan** → links to `home.html` (the member directory).
  - **Piranav** → links externally to `https://staff-requirements-02.vercel.app/` (a separate Vercel project/dashboard, opens in a new tab).
- Kept the `ledsone.co.uk` quick-link button (same style as the original toolbar) pointing to `pages/sales.html`, per explicit request ("in new index.html need ledsone.uk button also to navigate sales.html").

# Files Modified
- `reports/digital-marketing-member-pages/home.html` (new — copy of former `index.html`, trimmed to 6 members, counts corrected)
- `reports/digital-marketing-member-pages/index.html` (rewritten — two-card landing page)
- `reports/digital-marketing-member-pages/pages/*.html` (18 pages) — "&larr; Back to all members" link updated from `../index.html` to `../home.html`, since `index.html` no longer shows the member roster (found and fixed proactively — every staff page's back-link would otherwise have pointed at the new two-card chooser instead of the roster).

# Evidence Location
This file.

# Validation Result
Live-verified both pages return HTTP 200 post-deploy: `/` (new index.html) and `/home.html`. Confirmed zero remaining `../index.html` references across all `pages/*.html` files after the fix.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production.

# PASS / FAIL
PASS

# Next Step
1. Git commit/push — pending explicit user permission per repo's standing rule.
2. Confirm with user whether any internal links elsewhere in the site (e.g. other pages linking back to `index.html` expecting the old roster) need updating to point to `home.html` instead.
