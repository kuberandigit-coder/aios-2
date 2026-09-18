# Prompt — Internal Linking Suggestion Engine — STEP 03 ONLY: Check Existing Link Density

Date: 2026-09-18
Staff owner: Dilaksi
Site: https://ledsone.co.uk

## Original request (preserved verbatim, condensed)

Scope: Steps 01 (Content Index) and 02 (Find Link Opportunities) already implemented. Implement ONLY
Step 03 — Check Existing Link Density. Do NOT implement Step 04 or 05. No redesign, no separate app, no
Shopify content modification.

Objective: use the existing Content Index and Step 02's internal-link data to analyze internal-link
density per page — identify pages with too few links, a healthy level, or potentially too many. Must
audit Steps 01/02 first and reuse existing extraction/matching/URL-normalization logic, not duplicate it.
Clearly distinguish measured link count, configured threshold/rule, and resulting status.

Must calculate, at minimum: total internal links, unique internal target URLs, links by target type
(Product/Collection/Blog), links by source page type. Keep raw counts visible, don't collapse into a
percentage without a clear existing definition.

Critical rule: before creating thresholds, search the project/AIOS for an existing internal-linking rule
(minimum/maximum links, density thresholds, cornerstone rules, blog-linking rules). If found, use it —
don't replace it. If none exists, do NOT invent arbitrary SEO thresholds and present them as industry
facts — instead make thresholds configurable, clearly label as project configuration, document the
assumption, keep raw counts visible.

Task's own priority rules (referenced, not implemented yet — Step 03 only measures the underlying data):
cornerstone page + <3 internal links → High; new blog post + no product links → Medium. Step 03 must
calculate whether a page is cornerstone (only if an existing reliable classification exists — never guess;
mark unavailable if not), the internal link count, whether it's below the configured minimum, and the
density status. For blogs, measure product/collection/blog link counts (without assigning Medium priority
yet — that's for the priority engine).

Must distinguish total link occurrences vs unique target URLs (a page linking 5 times to the same target =
5 total, 1 unique — never collapse into 1). Self-links must never count as useful internal-link
connections. Should distinguish editorial content links from navigation/template links if the existing
data supports it; if it cannot, document this limitation honestly rather than pretending the distinction
exists.

Status model: Needs Attention / Sufficient / Review Required / Unknown (when no threshold is configured —
never invent one).

UI: add to the existing page, keep Steps 01/02 functional, Step 03 becomes functional, Steps 04/05 stay
locked. Summary KPIs (Pages Analyzed, Pages With Few Links, Sufficient, Requiring Review, No Links, Total
Internal Links, Unique Internal Targets — real data only). Table with page/type/counts/breakdown/status/
configured min/max/threshold source. Filters (type, status, link count, per-type counts) and search
(URL, title). Page detail showing the link summary and a plain-language density evaluation explaining the
exact count vs threshold vs resulting status.

Explicitly NOT implementing the priority engine yet: no High/Medium/Low/SEO-ranking/traffic-based/GSC-
or-GA4-based priority — that belongs to Step 04. If existing UI already shows priority fields, leave them
null rather than invent values. No AI suggestions, no automatic link insertion, no content modification.

Database: inspect existing structures first, reuse where possible, only add new tables if genuinely
needed. Backend: only Step 03 endpoints (calculate/recalculate, retrieve, filter, page detail) — no
Step 04/05 APIs. Performance: don't rescan the full Content Index on every frontend request; reuse
caching/refresh mechanisms; avoid unnecessary Shopify/API calls when Step 01 data already covers it.

Mandatory AIOS auto-update (evidence/validation/handover/source-map/capability, no closure until
genuinely complete, no secrets stored).

Final response must report: status, link-counting method, unique-target calculation, product/collection/
blog link identification, density rules used, database changes, endpoints, frontend changes, tests, AIOS
files updated, limitations, and explicit confirmation that Steps 04–05 were NOT implemented.

Full original prompt (all 30 numbered sections) is preserved in the assistant's session transcript for
this task; this file captures its substance for AIOS record-keeping without duplicating every line.
