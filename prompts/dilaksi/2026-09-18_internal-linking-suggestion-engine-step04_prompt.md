# Prompt — Internal Linking Suggestion Engine — STEP 04 ONLY: Generate & Prioritize Internal Link Suggestions

Date: 2026-09-18
Staff owner: Dilaksi
Site: https://ledsone.co.uk

## Original request (preserved verbatim, condensed)

Scope: Steps 01 (Content Index), 02 (Find Link Opportunities), and 03 (Check Existing Link Density)
already implemented. Implement ONLY Step 04 — Generate & Prioritize Internal Link Suggestions. Do NOT
implement Step 05 (handoff/content-team workflow). Do not automatically insert/modify links or Shopify/
blog/product/collection content.

Objective: turn Step 02's opportunities and Step 03's density data into clear, actionable suggestions
answering: for this page, what link should be added, where, what anchor text, which target, why, and how
important. Must audit Steps 01–03 first and reuse their outputs/fields/logic — do not recreate the
Content Index, opportunity detection, link extraction, Shopify client, blog source, URL normalization,
UAM, or task registration.

Inputs are explicitly Step 01 (source page/type/title/content/keywords/targets), Step 02 (source/anchor/
target/confidence/reason/context/existing-link status), and Step 03 (total links/unique targets/product/
collection/blog link counts/density status/thresholds) — do not duplicate these datasets, consume them.

For each valid opportunity, generate a structured "ADD LINK" suggestion (source, anchor, target, reason)
understandable as a plain implementation instruction without technical investigation.

Priority rules (now to be implemented, using the task's defined rules):
- HIGH: cornerstone page with fewer than 3 internal links.
- MEDIUM: new blog post with no product links.
- LOW: minor link-density imbalance.
- NO ACTION: page has sufficient internal linking, no actionable issue (prevents over-linking).

Critical: use actual Step 03 density data, don't invent new SEO thresholds. If the project already has
cornerstone/minimum-link/new-blog/density configuration, reuse it. If a required rule isn't yet
configurable/defined: do not invent a business rule, make it configurable where appropriate, document the
assumption/limitation, keep the underlying measured data visible. Specifically for cornerstone: use an
existing reliable classification if available, never guess which pages are cornerstone, mark unavailable
if none exists — never auto-classify by page type or traffic. Specifically for "new blog": use the
existing project definition of "new" if one exists; explicitly do NOT invent a publication-age threshold.

Suggestion quality gates (10 checks): source exists, target exists, target is a valid internal URL, source
≠ target, no existing link already present, anchor text meaningful and contextually relevant, target
relevant to source content, suggestion has an explainable reason, not duplicated — if any fails, do not
generate the suggestion. Avoid over-optimization: no repeated links to the same target from the same
source, no generic anchor text, no irrelevant matches, no links solely to increase link count.

Anchor text: use Step 02's identified opportunity as-is where already natural — don't unnecessarily
rewrite it; avoid "click here"/"read more"/generic phrases; no keyword-stuffing. Target selection: use
Step 02's matching/confidence, don't build a separate target-selection engine unless Step 02 lacks needed
info; if no sufficiently reliable target exists, status = "No Suitable Target" rather than forcing one.

Confidence: use Step 02's relevance/confidence; if Step 04 combines additional signals, document the
calculation; never represent the score as a Google ranking/SEO score — it's an internal DM Dashboard
recommendation score only.

Suggestion status model: New / Review Required / Approved / Rejected. IMPORTANT: do not implement Step 05
handoff — "Approved" must only mean "approved by Dilaksi for later handoff," never automatically sending
anything to the content team.

UI: make Step 04 functional on the existing page, keep Steps 01–03 functional, Step 05 stays locked.
Summary KPIs (Total Suggestions, High/Medium/Low Priority, No Action, Review Required, Approved,
Rejected — real data only). Table (priority, source, source type, anchor, target, target type, confidence,
reason, internal link count, density status, review status, action). Filters (priority, source/target
type, confidence, review status, density status) and search (source/target URL/title, anchor text).
Suggestion detail: source/target page info, suggested anchor, context snippet, why the target is relevant,
confidence, existing-link status, source density metrics, priority and the exact rule that caused it — do
not display a priority if the required condition can't be verified.

Approval: allow Dilaksi to Approve/Reject/Keep for Review; store reviewer, reviewed_at, review_status
using the existing authenticated user info — no new user system.

Explicitly forbidden: modifying Shopify/blog/product/collection content, inserting HTML links, publishing
content, creating redirects, automatically sending anything to the content team. This step only generates
and prioritizes recommendations.

Database: inspect existing Step 01–03 structures first, reuse/extend the opportunity table where possible;
only build a separate suggestion structure if genuinely required, following existing conventions. Backend:
only Step 04 endpoints (generate, retrieve, filter/search, detail, approve, reject) — no Step 05 handoff
APIs. Performance: don't repeatedly recalculate all opportunities on every page load; reuse Step 02/03
results, caching, and refresh mechanisms; avoid unnecessary Shopify/API requests.

Mandatory AIOS auto-update (evidence/validation/handover/source-map/capability, no closure until
genuinely complete, no secrets stored).

Final response must report: status, suggestion-generation method, confidence determination, priority
determination and rules used, database changes, endpoints, frontend changes, approval workflow, tests,
AIOS files updated, limitations, and explicit confirmation that Step 05 was NOT implemented.

Full original prompt (all 31 numbered sections) is preserved in the assistant's session transcript for
this task; this file captures its substance for AIOS record-keeping without duplicating every line.
