# PIRANAV — CLAUDE CODE ONBOARDING PROMPT (Digital Marketing Dashboard)

**Date:** 2026-07-03 · **Owner/reviewer:** Kuberan · **Team:** SEO / Digital Marketing
**Give this whole file to Claude Code on Piranav's PC as the first message of the session.**

---

## Who you are working for
You are Claude Code working for **Piranav**, a member of Kuberan's digital-marketing team. Piranav builds and maintains **team-member requirement pages** on the shared dashboard. Kuberan is the owner and reviewer of all work.

## The project
- **Repo (shared team dashboard):** https://github.com/digitalmarketing69140951-sys/Staff-requirements (private; Piranav is a collaborator)
- **Live site:** https://digital-marketing-member-pages.vercel.app
- **Deployment:** Vercel is git-connected — **every push to `main` auto-deploys to production.** There is NO separate deploy step and Piranav needs no Vercel login. Push = live.
- **Structure:** `index.html` (homepage with one expander card per team member) · `pages/` (one HTML page per member requirement, e.g. `dilaksi.html`, `dilaksi-req2-all-products.html`) · `assets/`

## First-time setup (do these once, in order)
1. Verify Git is installed (`git --version`), then clone:
   `git clone https://github.com/digitalmarketing69140951-sys/Staff-requirements.git`
   (When prompted, sign in with PIRANAV's GitHub account in the browser popup.)
2. Set identity: `git config --global user.name "Piranav"` and his email.
3. Save the service-account key Kuberan sent privately to:
   `C:\Users\<piranav-user>\.keys\ga4-service-account.json`
   **NEVER copy this file into any git repo or paste its contents anywhere.**
4. Piranav connects MCP connectors in HIS claude.ai → Settings → Connectors:
   - **Shopify** (requires Piranav to be staff on the LEDSone store — ask Kuberan if not)
   - **Semrush**
5. Python needed for data scripts: `pip install google-analytics-data google-api-python-client google-auth`

## Data sources — how to gather data (all read-only)
| Source | How | Details |
|---|---|---|
| GA4 | Python + service-account key | property **408110563**; use `RunReportRequest`, filter `sessionDefaultChannelGroup = Organic Search` for organic data |
| Google Search Console | SAME key file | property `sc-domain:ledsone.co.uk` (Restricted access); Search Analytics API |
| Shopify | MCP connector (`graphql_query` for reads) | store: LEDSone UK Ltd (ledsone.co.uk) |
| Semrush | MCP connector | discovery tool → `get_report_schema` → `execute_report` |
| Live site checks | HTTP requests + sitemap.xml chain | for link/live-status verification |

## Working rules (MANDATORY — same rules Kuberan's Claude follows)
1. **NEVER invent data.** Every number on a page must come from a real connector/API call or be explicitly marked "Pending". If a source is unavailable, show "Pending — <source>" rather than a guess.
2. **Always `git pull` before starting any work** — Kuberan pushes to the same repo.
3. **Only touch your own assigned member pages.** Do not edit other members' pages or Kuberan's work. `index.html` is shared — ask Kuberan in chat before editing it (e.g. adding a new card/button).
4. **Push only when a task is complete and verified locally** — remember push = instant production deploy. After pushing, verify the live URL loads (HTTP 200) and shows the change.
5. Every report page must state its data sources, date window, and generation date (follow the existing pages in `pages/` as templates — e.g. the Dilaksi pages show the pattern: value + explanation + source label per table cell).
6. Commit messages: `feat: YYYY-MM-DD - <member> <requirement> <short summary>`.
7. Keep raw fetched data as CSV alongside work when practical, so numbers are auditable.
8. If anything is unclear about a requirement, ask the team member / Kuberan — never assume business rules (e.g. "Recommended Action" logic must be user-approved).

## Style/template reference
Open `pages/dilaksi-req3-pages-for-removal.html` — it is the approved reference for table layout: fixed column widths (`table-layout:fixed` + `colgroup`), monospace URL chips, per-cell detail (bold value + grey explanation + small uppercase source label), green/red pills for yes/no status, summary cards on top, methodology footnotes at the bottom.

## Verification standard (every completed task)
- Data fetched from real sources (state which, with dates)
- Page renders correctly locally before push
- After push: live URL returns 200 and shows the new content
- Report PASS/FAIL honestly to Piranav/Kuberan

---
*Prepared by Kuberan's Claude session, 2026-07-03. The full private AIOS system stays in Kuberan's repo; this shared repo contains the dashboard only.*
