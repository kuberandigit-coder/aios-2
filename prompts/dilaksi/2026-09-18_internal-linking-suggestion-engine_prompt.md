# Prompt — Internal Linking Suggestion Engine (Dilaksi) — Page Creation + Step 01 Content Index

Date: 2026-09-18
Staff owner: Dilaksi
Site: https://ledsone.co.uk

## Original request (preserved verbatim, condensed)

Create a new Development Task page called "Internal Linking Suggestion Engine," owned by Dilaksi, under
DM Dashboard's existing Development Tasks section. Scope for THIS implementation, explicit and repeated:

> ONLY implement: PAGE CREATION + UAM + ROUTING + STEP 01 CONTENT INDEX.
> DO NOT implement Step 02, Step 03, Step 04, or Step 05 yet.

Required first step: audit the existing project (Development Tasks navigation, UAM, taskRegistry.js,
routing, DashboardShell/sidebar, table/page components, API patterns, DB patterns, Shopify integration,
content/product/collection retrieval) and reuse everything possible — no duplicate navigation, UAM,
task-registration, API-client, Shopify-client, page-component, table-component, or DB-utility systems.

Page must show all 5 workflow steps (Content Index / Scan for Link Opportunities / Check Existing Link
Density / Generate Suggestions / Handoff for Implementation), with Steps 02–05 visibly locked/coming-soon.

Step 01 — Content Index: build a read-only index of LEDSone UK's Blog, Product, and Collection pages
(URL, page type, title, content, target keywords only if a reliable existing keyword source exists —
never fabricated). Explicit data-source audit requirement: reuse the existing Shopify Admin API
integration for products/collections (no new client, read-only, no credential exposure); for blog
content, determine the current authoritative source in the project — reuse if one exists, do not scrape
if an approved source already exists, document if none exists rather than inventing one.

Explicitly excluded from this implementation: keyword opportunity detection, anchor text generation,
internal link recommendations, link density analysis, cornerstone analysis, blog-to-product link
detection, AI-generated suggestions, suggestion ranking, content team handoff, automatic link
insertion/content modification/Shopify changes — all deferred to future steps.

Mandatory: AIOS auto-update after implementation (this record + evidence + validation + handover +
source-map + capability, no closure until genuinely complete, no secrets ever stored in AIOS).

Full original prompt (all 20 numbered sections) is preserved in the assistant's session transcript for
this task; this file captures its substance for AIOS record-keeping without duplicating every line.
