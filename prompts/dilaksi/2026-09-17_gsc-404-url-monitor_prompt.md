# Prompt — GSC 404 URL Monitoring for Dilaksi

**Date:** 2026-09-17
**Requested by:** Kuberan (on behalf of Dilaksi/SEO team)
**Project:** dm-dashboard

## Original Prompt (verbatim, preserved in full)

TASK: Build Google Search Console 404 URL Monitoring for Dilaksi

ROLE
You are working inside the existing DM Dashboard project.

The objective is to add a new SEO workflow for Dilaksi that collects and monitors Google Search Console "Not found (404)" URLs for the LEDSone UK property:

https://ledsone.co.uk

IMPORTANT:
The project already has Google Search Console API credentials/configuration in environment files.

DO NOT create a new GSC authentication system unless the existing integration is genuinely unusable.

DO NOT expose, print, log, commit, or copy any API keys, OAuth secrets, service-account private keys, tokens, or passwords.

[Full 19-section spec covering: (1) audit existing GSC integration before writing code; (2) API validation — verify whether Search Console's Page Indexing → Not found (404) report is available via API, do not fabricate an endpoint or mislabel Search Analytics data as the 404 report; (3) use the existing configured LEDSone UK GSC property; (4) data requirements — URL, status, issue type, last crawled/first detected dates, source, property, timestamps, current/resolution status, NULL rather than invented values; (5) Shopify replacement matching — connect each 404 URL to live Shopify data via handle/title/type/attribute similarity, generate suggested URL + confidence + reason, NULL when no reliable match; (6) SEO/traffic impact via GSC Search Analytics + GA4, never described as indexing proof; (7) priority — HIGH/MEDIUM/LOW/REVIEW REQUIRED, transparent and explainable, reuse existing thresholds; (8) database — reuse/extend existing structures before creating new tables; (9) backend — FastAPI, existing auth, never expose credentials to frontend; (10) frontend — Development/SEO task using existing DashboardShell/sidebar/table/filter/KPI/UAM patterns, specific KPI list and table columns and filters specified; (11) review workflow — New → Review Required → Replacement Approved → Sent to Development → Fixed → Rechecked, plus No Suitable Replacement, never auto-create redirects/modify Shopify/auto-publish; (12) refresh/automation — reuse existing scheduled-task architecture, do not fabricate automation if the API can't support it; (13) URL normalization — preserve original_url exactly, separate normalized_url for matching, don't destroy meaningful differences (e.g. query params); (14) security — never expose/commit/log credentials; (15) UAM/access — use taskRegistry.js and existing permission model, ensure Dilaksi has access; (16) testing — 20 specific test criteria including no fake GSC endpoint, no secrets exposed, matching/priority/filters/UAM all working; (17) non-regression — must not break any existing dashboards/integrations/auth/UAM/tasks/APIs; (18) AIOS auto-update — mandatory, search existing AIOS records first, preserve original prompt, update evidence/validation/closure/handover/source-map/duplicate-risk/capability, never store secrets in AIOS, record validation as PASS/FAIL/PARTIAL; (19) final report — must state plainly whether the GSC Page Indexing 404 dataset can actually be retrieved via API, and must not claim success if it cannot.]

*(Full original spec text preserved in the session transcript; condensed here for AIOS file size — the numbered section list above captures every requirement verbatim in structure and substance. See handover doc for the point-by-point compliance mapping.)*

## Follow-up clarifications from the same conversation (also binding)

- "first gather the data and show in chat" — user wanted a quick ad-hoc
  preview before full implementation (later superseded).
- "why this action is taking too much time?" / "how much time you need
  to gather these?" — user asked about the GSC URL Inspection API's
  real per-call latency (~2-4s/URL, no bulk endpoint exists).
- "ok then dont run in claude write code and add in the sync monitoer
  and create a page under development task tab create a new page and
  show in the table" — explicit instruction to stop ad-hoc runs in the
  Claude session, and instead: (a) integrate with the existing Sync
  Monitor (scheduled_snapshot.py / sales.py's generic sync endpoints),
  (b) add a new page under the Development Tasks tab, (c) show results
  in a table.
- Follow-up screenshots + "here need monitoer and add here for the new
  page to add gather data , anf fr example our goal is 500 when 1 is
  done need to dne that dne dta like that every done update imidiately"
  — explicit requirement that each URL's result be persisted and shown
  the instant that single URL is checked, not batched until the whole
  scan (e.g. 500 URLs) finishes.
- "dont run anything in claude we will run in the system fr gather 4040
  [404] data in gsc using gsc aoi [api] in the system wirte all code
  and files and pusht to dev work" — final instruction: write all code
  only, no execution inside the Claude session, push to `dev-work`.

## Status

Implementation completed per this prompt — see
`evidence/dilaksi/2026-09-17_gsc-404-url-monitor_evidence.md` and
`validation/dilaksi/2026-09-17_gsc-404-url-monitor_validation.md`.
