# Handover — Blog HTML Automation Step 3 Implementation

Date: 2026-10-07
Status: **Implemented and live-verified against real data at the function/API level. NOT yet
manually smoke-tested in a running browser. Closure deliberately NOT written yet.**

## Feature implemented

Blog HTML Automation -- Shopify Ready-to-Publish Blog HTML Generator. New Development Task,
full pipeline: site/topic selection → real input aggregation (GSC, Content Gap, AEO/GEO,
Shopify products, Internal Linking) → clean & group → outline → AI+deterministic HTML generation
(product cards, links, images, body copy, FAQ) → QA (18 checks) → human review → manual
copy/open-Shopify/confirm-published → history log.

## Architecture

New package `backend/app/dev_tasks/blog_html_automation/` (9 files, matching the approved Step 2
file table exactly) + new frontend page
`frontend/src/admin/pages/dev-tasks/BlogHtmlAutomation.jsx`. One new table,
`blog_html_automation_generation`. Registered as `tools.BlogHtmlAutomation` in both
`taskRegistry.js` (UAM) and `devTasksRegistry.js` (the actual sidebar-visibility source of
truth, discovered during implementation).

## Data sources

Real GSC data (`blog_optimization`'s already-synced tables, 3 confirmed-working sites), real
Content Gap cache, real AEO/GEO data (UK only, per `geo_visibility`'s own existing scope), real
Shopify products (live GraphQL, any site with a configured Shopify credential), real Internal
Linking suggestions (currently single-store, surfaced as `partial` for other sites, not hidden).

## Important logic

- FAQ visible HTML is rendered directly from the parsed FAQPage JSON-LD the existing
  `faq_schema.py` already generates -- not a second AI call, structurally cannot diverge from
  the schema.
- Product/link/image URLs in the generated HTML are always copied verbatim from real fetched
  data -- the AI body-copy prompt never supplies a URL, price, or image.
- Body-copy prompts are store-aware (reuse the 2026-10-07 hardcode fix's domain/locale
  resolution) -- confirmed live for `ledsone.de` (real German FAQ content generated).

## QA

18 checks implemented (word count, product/link/image/FAQ counts, FAQ-schema match, no-H1,
heading structure, no duplicate links, placeholder detection, HTML validity, URL-matches-source
checks for products/links/images, plus 2 explicitly `not_checkable` meta checks since meta
fields aren't part of the generated body). Live-tested against real AI output: 16/18 passed, 2
genuinely failed (word count, HTML tag-balance heuristic) -- confirms QA actually catches real
issues rather than rubber-stamping.

## Manual Shopify publishing boundary

No Shopify write capability anywhere in the new code (confirmed by reading every file). Workflow
ends at a "Copy" button, an "Open Shopify" link (opens the real admin, does not write), and a
"Confirm Published" button that only records a URL the user pastes in after publishing manually.

## Known limitations

- **AI-generated word count can undershoot the 1350–1650 target** (one real test: 886 words) --
  QA correctly flags this, but the generation prompt may need tuning to hit the target more
  reliably. Not a structural bug.
- **No live browser click-through performed this session.** The frontend page was built
  (`npx vite build` clean) and its API calls match the backend's confirmed-working endpoints,
  but no one has actually opened the page and used it end-to-end in a browser yet.
- **DE Shopify blog-content read is still blocked** (the `read_content` scope gap from the
  2026-10-07 hardcode-fix session) -- product/image/GSC inputs work for DE, but anything that
  would need to read existing DE blog content does not (not exercised by this feature's
  generation flow, which only writes new content, but worth noting).
- **Internal Linking suggestions remain single-store** -- correctly surfaced as `partial`, not
  fixed by this implementation (explicitly out of scope, carried forward from Step 1/2).
- **Outline planning stayed fully deterministic** (no LLM call) per the Step 2 open question --
  resolved during implementation in favor of the simpler, already-working approach; can be
  revisited if topic naming needs to be richer than raw keyword/query text.
- **"Collection URL vs. blog post" relationship** (Step 2's open question #3) was resolved
  during implementation as: the collection URL is a CONTEXT input used to source real
  products/images, the output is always a new BLOG POST, never collection-page content itself.
  This was an implementation judgment call, not a separately confirmed decision from Dilaksi --
  worth a quick confirmation.

## Current status

Backend and its real external integrations (GSC, Shopify, LLM, FAQ) are proven live-working.
Frontend compiles and follows the confirmed-working API contract but is unverified in an actual
browser session. **Not closed out** -- see next step.

## Next step

1. Open the page in a real browser session, click through the full workflow for one real site/
   topic, confirm the UI behaves as built (polling, QA display, Code/Preview toggle, publish
   confirmation).
2. Tune the body-copy prompt if word count continues to undershoot across multiple real runs.
3. Confirm the "Collection URL as context input" interpretation with Dilaksi.
4. Once both are confirmed, revisit whether this feature is ready for a closure record.

## Technical owner

Kuberan (per this repo's existing AIOS convention -- `CLAUDE.md`'s "File naming" and the
established pattern across every other dm-dashboard handover record in this folder).
