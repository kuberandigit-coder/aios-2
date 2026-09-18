# Prompt — Internal Linking Suggestion Engine — STEP 02 ONLY: Find Internal Link Opportunities

Date: 2026-09-18
Staff owner: Dilaksi
Site: https://ledsone.co.uk

## Original request (preserved verbatim, condensed)

Scope: Step 01 (Content Index) already implemented. Implement ONLY Step 02 — Find Link Opportunities.
Do NOT implement Step 03, 04, or 05. Do not redesign the page or create a new standalone application.

Objective: use the Step 01 Content Index to identify internal-link opportunities across Blog/Product/
Collection pages — where a page mentions a topic/product/category that could naturally link to another
relevant LEDSone page but currently doesn't. Must audit the existing Step 01 implementation first and
reuse it, not recreate it.

A potential opportunity requires: a meaningful phrase, a relevant existing page, no existing link for that
phrase to that target, a valid internal URL, and sufficient relevance — never suggested purely from one
shared common word. Candidate anchor text comes from target keywords/product names/collection names/
product types/category terms/meaningful phrases — never generic words ("click", "here"), never invented
keywords. Matching should consider multiple signals (title, phrase similarity, product type, category,
handle, page type) and must determine the most relevant target, not just any page containing the phrase.

Critical: before creating an opportunity, check whether the source page already links to that target —
if so, no opportunity. Self-links must never be recommended. Duplicate opportunities (same source→anchor→
target) must be deduplicated. Context around the match should be considered — a topic mention in a
generic sentence shouldn't auto-become a recommendation without contextual relevance. Every opportunity
needs a transparent, documented confidence/relevance score (not an arbitrary or Google-ranking-implying
number) and a clear, specific reason (never "AI thinks this is relevant").

Explicitly excluded from Step 02: priority levels (High/Medium/Low/cornerstone/traffic-based ranking —
that's Step 04), link-density analysis (Step 03), suggestion ranking, content-team handoff, and any
automatic link insertion or content modification — this step only discovers and displays opportunities.

UI: add to the existing page, summary cards (Pages Scanned, Potential Opportunities, Existing Links
Detected, Opportunities After Deduplication — real data only), an opportunity table (source/target page,
anchor text, confidence, reason, existing-link status), filters (source/target type, confidence, has-
existing-link, search), and a context-preview detail view.

Backend: follow existing FastAPI architecture, only Step 02 endpoints (generate/refresh, retrieve, filter,
detail) — no Step 03-05 APIs. Performance: avoid brute-force every-page×every-page×every-phrase; reuse
indexes/normalized text/efficient candidate filtering; don't overload the database. Database: inspect
existing structures first, only create new ones if genuinely required.

Mandatory AIOS auto-update after implementation (evidence/validation/handover/source-map/capability, no
closure until genuinely complete, no secrets ever stored).

Final response must report: status, detection method, existing-link check method, matching/relevance
logic, database changes, endpoints, frontend changes, tests, AIOS files updated, limitations, and explicit
confirmation that Steps 03–05 were NOT implemented.

Full original prompt (all 30 numbered sections) is preserved in the assistant's session transcript for
this task; this file captures its substance for AIOS record-keeping without duplicating every line.
