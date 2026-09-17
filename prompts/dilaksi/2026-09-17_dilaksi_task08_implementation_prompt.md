# Prompt — Dilaksi Task 08 Implementation (Broken Link / 404 Monitor)

Date: 2026-09-17
Distinguished from the earlier same-day `..._task08_screaming_frog_cli_setup_prompt.md` (OS-level CLI verification only, no code).

## Verbatim governing directive (as received by the implementing fork)

> Implement Dilaksi Task 08 — Broken Link / 404 Monitor as a new
> Development Task in the dm-dashboard codebase
> (C:\Users\PC\Desktop\dm-dashboard), following the user's full spec
> below EXACTLY. You already know this codebase deeply from today's/
> yesterday's session work (meta_audit package structure,
> alt_text_keywords conventions, jreq-* CSS system, dev_tasks/__init__.py
> wiring, taskRegistry.js + AdminLayout.jsx + DevLayout.jsx
> triple-registration pattern for Development Tasks, git workflow on
> dev-work branch with explicit push-only-when-told, direct production
> Postgres access via backend/.env's corrected DATABASE_URL, and the
> Screaming Frog CLI verified today at C:\Program Files (x86)\Screaming
> Frog SEO Spider\ScreamingFrogSEOSpiderCli.exe v22.2, with the test
> script at C:\Users\PC\Desktop\kuberan web\tools\dilaksi-task08-
> screaming-frog\test-cli.ps1). Reuse ALL of that — do not rebuild any of
> it.
>
> **PROJECT**: DM Dashboard. **New task**: "08 — Broken Link / 404
> Monitor". **Staff**: Dilaksi. **Site**: https://ledsone.co.uk
>
> **CURRENT STATE**: Screaming Frog SEO Spider CLI is already connected/
> working. DO NOT reinstall, DO NOT create another integration, DO NOT
> replace existing CLI config — but there is NO prior dm-dashboard CODE
> integration; this task IS the first backend integration of the
> already-OS-verified CLI.
>
> Existing Development Tasks sidebar (in order): Content Gap Analysis,
> E27 Competitor Analysis, AI/GEO Visibility Gap Analysis, Alt Text
> Keyword Finder, Meta Title & Description Audit. New task MUST be added
> to this list, after Meta Title & Description Audit.
>
> **PRIMARY OBJECTIVE** (14 numbered sub-goals): Run Screaming Frog CLI
> crawl → process crawl results → detect broken internal links → detect
> broken outbound links → detect relevant 4xx/5xx → identify source
> URL→broken URL relationships → match against GSC data → match against
> GA4 traffic data → check Shopify context → suggest redirect target only
> with sufficient evidence → assign documented priority → present as
> Development Task for Dilaksi → allow review/status tracking → create
> development-ready remediation backlog. Do NOT automatically publish
> redirects or modify Shopify production data.
>
> **STEP 1** — Audit existing Development Task architecture (sidebar,
> routing, task pages, registration, components, API patterns, styling,
> data models, taskRegistry.js/UAM, auth/authz, dashboard shell) —
> specifically inspect Content Gap Analysis, E27 Competitor Analysis,
> AI/GEO Visibility Gap Analysis, Alt Text Keyword Finder, Meta Title &
> Description Audit (meta_audit is "freshest/most relevant template").
> REUSE THE EXISTING PATTERN, do not create a parallel architecture.
>
> **STEP 2** — Add "08 — Broken Link / 404 Monitor" to Development Tasks
> nav, after Meta Title & Description Audit, using existing styling/
> indentation/active-state/routing/icons. Mirror the alt-text-keywords/
> meta-audit triple registration (AdminLayout.jsx, DevLayout.jsx,
> taskRegistry.js). Do not redesign sidebar.
>
> **STEP 3** — Screaming Frog CLI: inspect existing integration (none
> exists yet in code — build the first one), reuse verified executable
> path, execution method, output handling, error handling. Crawl target
> https://ledsone.co.uk. Must execute controlled crawl and process
> results. Track crawl ID, start/completion time, status, error, result
> location, last successful crawl. Prevent duplicate simultaneous crawls
> (non-blocking background-job pattern). Do NOT execute a full production
> crawl merely while developing the UI — use `--crawl-list` against a
> small handful of known URLs or check for a max-URL-limiting flag; a
> full unrestricted crawl is explicitly NOT authorized — flag this
> clearly rather than running one.
>
> **STEP 4** — Broken Link Detection: process Screaming Frog CSV exports
> (Response Codes/Internal/External export types, verify via `--help`,
> don't guess). Identify broken internal links, broken outbound links,
> relevant 4xx, relevant 5xx. Capture per issue: source URL, broken URL,
> HTTP status, internal/external, link type, first seen, last seen, crawl
> ID. Do not classify temporary crawler failures as confirmed broken
> without sufficient evidence.
>
> **STEP 5** — GSC data: inspect existing GSC integration (google_
> client.py's query_gsc, already used in dilaksi.py, seo_intelligence.py).
> Reuse it. Match URL/Clicks/Impressions/period. If no match: "No GSC
> data" — never fabricate.
>
> **STEP 6** — GA4 data: inspect existing GA4 integration (google_
> client.py's fetch_ga4_report, same one meta_audit's router.py uses).
> Reuse it. Match URL/Sessions/Users/period. If unavailable: "No GA4
> data" — never fabricate.
>
> **STEP 7** — Shopify context: reuse existing Shopify Admin API
> integration (shopify_client.py, STORE="ledsone_uk"). Check whether
> broken URL corresponds to Product/Collection/Page/Other. Determine
> exists/active/unavailable/removed/unknown where possible. Do not modify
> Shopify data.
>
> **STEP 8** — Redirect target suggestion: only with sufficient evidence
> (Shopify product/collection relationship, handle similarity, URL
> relationship, title similarity, product/category relevance, existing
> canonical relationship). Each suggestion: Suggested Redirect Target,
> Confidence, Reason. If no reliable target: "No redirect suggestion".
> NEVER invent a target. NEVER auto-create the redirect.
>
> **STEP 9** — Priority rules (exact business rules from original Task 08
> requirement): Broken link with traffic/backlinks → High. Broken link,
> low traffic → Medium. Broken outbound link only → Low. No broken links
> found → No action. Do not invent numerical thresholds — check if
> codebase already has documented traffic/backlink thresholds (reuse); if
> none, make configurable and document the assumption.
>
> **STEP 10** — Development Task UI: existing architecture (jreq-*
> classes, meta_audit page's tab-bar/KPI-card/filter-bar/pagination as
> closest template). SUMMARY KPIs: Total Broken Links, Broken Internal
> Links, Broken Outbound Links, 4xx Issues, 5xx Issues, High/Medium/Low
> Priority, Resolved. CRAWL STATUS: Last Crawl, Last Successful Crawl,
> Current Crawl Status, Next Scheduled Crawl, Crawl error, a "Run Crawl"
> control (never expose raw server commands to browser — only a
> controlled API call). BROKEN LINK TABLE columns: Priority, Source URL,
> Broken URL, HTTP Status, Type, GA4 Sessions, GSC Clicks, GSC
> Impressions, Suggested Redirect, Confidence, Review Status, Development
> Status. FILTERS: Priority, Internal/External, HTTP Status, Issue Type,
> Review Status, Development Status, Traffic, Crawl Date. SORTING:
> Priority, GA4 Sessions, GSC Clicks, GSC Impressions, HTTP Status, First
> Seen, Last Seen. DETAIL VIEW: expand a row showing everything.
>
> **STEP 11** — Review/development workflow states: New, Reviewed,
> Approved, In Development, Ready for Validation, Resolved, Rejected, No
> Action. Don't create duplicate status system if equivalent exists
> (verify first).
>
> **STEP 12 (MANDATORY)** — UAM: add via existing taskRegistry.js, same
> tools.Dev* pattern (kind: 'tool', no ownerStaffKey — gated by grant not
> staff_key, exactly like Alt Text Keyword Finder / Meta Title &
> Description Audit). Verify: Dilaksi/granted user sees+opens it;
> unauthorized can't unless granted; admin/dev works; direct URL access
> protected the same way existing tasks are (honest note: most data
> endpoints do NOT enforce JWT server-side — isolation is
> frontend-routing/grant concern; be honest about this rather than
> claiming stronger protection); page refresh doesn't bypass frontend
> grant check; existing tasks/dashboards unaffected.
>
> **STEP 13** — Backend/API: FastAPI, follow meta_audit/router.py and
> alt_text_keywords/router.py patterns exactly. Endpoints under
> `/api/dev/broken-link-monitor/...` (Development Tasks live under
> `/api/dev/<task-name>/`, not `/api/dilaksi/...`): GET .../summary, GET
> .../results (or /broken-links), GET .../{id}, POST .../crawl, GET
> .../crawl-status, PATCH .../{id}/review, PATCH .../{id}/status. Use
> existing auth conventions. Never expose secrets.
>
> **STEP 14** — Database: inspect existing tables first. New tables:
> public.broken_link_monitor_crawls (crawl history/status) and
> public.broken_link_monitor_issues (one row per detected issue, with
> review_status/dev_status columns) — reuse meta_audit/alt_text_keywords'
> ensure_schema() + module-level schema.py pattern exactly. Respect
> get_conn() pool/connection limits. Don't do expensive full scans on
> every page load — dashboard reads STORED crawl results.
>
> **STEP 15** — Automation/scheduling: inspect existing scheduler
> patterns (ScheduledSnapshot, BackgroundJob, meta_audit's own
> thread-based job tracker). Reuse appropriate one, don't build new
> scheduler class. Support triggering a crawl (manual for now — actual
> cron scheduling can be documented "not yet wired" if genuinely out of
> safe scope, but tracking fields for "next scheduled crawl" should still
> exist in the data model even if unpopulated). Track last/last-
> successful crawl, current status, next scheduled crawl, failure reason.
> Prevent overlapping crawls.
>
> **STEP 16** — Security: never expose Shopify tokens, GSC/GA4
> credentials, DB passwords, Screaming Frog licence info, private keys —
> not in React code, browser responses, git, AIOS, or logs.
>
> **STEP 17** — Regression safety: test T01–T25, record real evidence not
> assumed.
>
> **MANDATORY AIOS AUTO-UPDATE**: AIOS ROOT as given
> (C:\Users\PC\OneDrive\Desktop\kuberan web) DOES NOT EXIST — confirmed
> earlier same day. Real AIOS repo: C:\Users\PC\Desktop\kuberan web (no
> OneDrive) — use that. Search AIOS first (Dilaksi, Task 08, Broken Link,
> 404, Screaming Frog, SEO crawler, Development Tasks, UAM, taskRegistry,
> GSC, GA4, Shopify, redirect) — will find 2026-09-16 Dilaksi Req07
> records and today's (2026-09-17) Screaming Frog CLI setup records.
> REUSE/EXTEND those where relevant. Preserve original prompt verbatim in
> a new prompts/dilaksi/ file dated 2026-09-17 distinguished from today's
> earlier CLI-setup prompt. After implementation update: DOCS, EVIDENCE,
> VALIDATION (PASS/FAIL/PARTIAL per area, honest about auth-model
> caveat), HANDOVER, CLOSURE (only if genuinely complete), SOURCE-MAP
> (update existing 2026-09-17 Screaming Frog entry), DUPLICATE-RISK,
> CAPABILITY. Never store credentials/secrets in AIOS.
>
> Commit dm-dashboard code to dev-work branch — do NOT push. Commit AIOS
> docs to AIOS repo git on whatever branch today's earlier Screaming-
> Frog-CLI commit used (main, committed directly not pushed) — do NOT
> push that either.

## Coordinator's additional process notes (also part of the governing directive)

- Actually inspect the repo (Glob/Grep/Read), not summaries.
- Verify Screaming Frog CLI path directly. Use PowerShell for CLI
  invocation where relevant.
- The "no full crawl" constraint is important — use `--crawl-list`
  against a tiny handful of known URLs.
- Verify DATABASE_URL in backend/.env still points at the corrected
  production host before live DB testing.
- Run `python -m py_compile` on every new/changed backend file and
  `npx vite build` on frontend before considering anything done.
- Be rigorous/honest in validation — PARTIAL or a noted real limitation
  rather than a false PASS.
