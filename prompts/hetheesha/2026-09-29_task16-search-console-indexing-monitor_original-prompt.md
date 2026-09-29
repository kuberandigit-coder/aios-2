# Original Prompt — Task 16: Search Console, Sitemap & Indexing Monitor (Hetheesha, Phase 1)

**Date:** 2026-09-29
**Owner:** Hetheesha  **Reviewer:** Kuberan

The user pasted a full structured prompt titled "AIOS DEVELOPMENT TASK —
HETHEESHA — SEARCH CONSOLE, SITEMAP & INDEXING MONITOR — PHASE 1 — ISSUE
DETECTION & PRIORITISATION" for ledsone.fr. Preserved in full below.

---

Target: ledsone.fr. Build Phase 1 (read-only) of a Development Task that
detects Search Console indexing issues, sitemap status and priority URLs,
inside the existing DM-Dashboard's Development Tasks section, gated by User
Access Management, following the existing dashboard architecture exactly
(no standalone app, no duplicate GSC auth/API client/permission system).

Core flow: GSC data -> detect issue -> understand issue -> assign priority ->
show recommended next action.

Explicitly OUT of scope for Phase 1: Request Indexing, GSC write operations,
automatic fixes, Shopify modifications, automatic revalidation, PASSED/FAILED
workflow, automatic task assignment, a second access-management system.

Required before building: inspect the existing dashboard (Development Tasks
nav, User Access Management, GSC integration/auth/API client, DB patterns,
existing card/table/filter/drawer components) and search AIOS documentation
for GSC/Search Console/Hetheesha/Sitemap/Indexing/Development Tasks/User
Access Management/URL Inspection, and reuse rather than duplicate.

Navigation: must appear as a sub-tab under the existing Development Tasks
section, not as a new top-level section; must not break or rename existing
Development Task navigation.

Access: task key `tools.DevSearchConsoleIndexingMonitor` (or the project's
existing naming convention if different), enforced in both frontend and
backend, integrated into the existing User Access Management UI (not a new
access system).

Data (Phase 1): sitemap data (submitted sitemap, URL, submitted/indexed
counts, errors, warnings, last processed) and indexing issues using only
real GSC-provided reasons (Crawled — currently not indexed, Discovered —
currently not indexed, Duplicate variants, Alternate page with proper
canonical, Blocked by robots.txt, Excluded by noindex, Soft 404, Server
errors/5xx, other available exclusion reasons). Never invent a reason; show
"Data unavailable from Search Console API" when GSC does not provide
something.

High-value URL detection: use existing authoritative project data
(Shopify/GA4/revenue/product performance/existing SEO priority logic) where
available; do not create a new external data source for this; high-value +
not indexed = HIGH priority.

Indexing trend: compare current period vs previous comparable period where
valid historical data exists (indexed pages decrease >10%, non-indexed
increase, 5xx increase, exclusion-reason shift); never manufacture a trend
— show "Historical comparison unavailable" when there is no history yet.

Priority rules: HIGH (high-value not indexed, soft 404/5xx on an important
page, >10% week-on-week indexed drop, other clearly severe issue), MEDIUM
(low-value "Crawled — currently not indexed", meaningful exclusion needing
investigation), LOW (minor/low-impact issue), NO ACTION (correctly/
intentionally excluded URLs). Every finding must show priority, issue type,
URL/affected count, GSC reason, detection date, data source, plain-language
explanation, and recommended next investigation.

UI: professional, clean, trainee/SEO-staff friendly, not a developer-only
technical screen; Summary -> What is wrong -> Why -> Which URLs -> What
should I check; use the existing DM-Dashboard design system. Page header
(title, short description, Site: ledsone.fr, Last data refresh, a single
"Refresh Data" action — no Fix button in Phase 1). KPI summary cards
(sitemap URLs, indexed, not indexed, high priority, medium). A simple visual
priority breakdown (not a complicated chart). Main issue table (Priority,
Issue, URL/Count, Google Reason, Detected, Source, Status — status is always
DETECTED in Phase 1) with filters (search, priority, issue type, indexed/
not indexed, template where it exists, date) that update without full page
reloads. Clicking an issue opens a detail drawer (Detected/what/priority/
URL/Google Reason/Why this matters/Next Action guidance only, non-functional
in Phase 1/Source/Detected date), with the Next Action shown as a clean
developer-style visual flow, not raw terminal text. Loading/empty/error
states with the exact specified copy.

Backend: follow the existing FastAPI architecture and reuse the existing GSC
API/auth; suggested routes GET overview/issues/sitemaps/trends/url-detail
under `/api/dev/search-console-indexing`; reuse/extend existing equivalents
instead of duplicating; inspect existing conventions first.

Database: inspect existing patterns first; reuse existing GSC
caching/snapshots rather than creating duplicate GSC tables; only add new
tables if persistent storage is actually required.

Security: never expose OAuth secrets/tokens/credentials to the frontend or
logs; use existing environment variables; enforce access control server-side
on every route.

Read-only safety: Phase 1 must not modify Shopify, Search Console, the
sitemap, website content, canonical settings, robots.txt, or indexing
settings; no Request Indexing, no GSC mutation, no automatic fix.

Acceptance tests, "do not implement in Phase 1" list, and a mandatory AIOS
auto-update (search first, reuse, then document what was implemented, exact
files, exact routes, exact permission key, UAM changes, navigation changes,
GSC auth/data flow, detection rules, priority rules, historical comparison
logic, DB changes, UI/UX structure, known limitations, tests performed and
results, evidence/references, capability documentation, Phase 1 closure
documentation, Hetheesha staff handover, and a search-again duplicate check)
were also specified in full, along with a required final developer report
format (Implemented / Navigation / Access Control / Files Changed / API-Data
/ Detection / Priority / UI / Tests / Limitations / AIOS Updated).

Full verbatim text is preserved in the assistant's conversation transcript
for this session; this file summarises it faithfully for the AIOS record.
