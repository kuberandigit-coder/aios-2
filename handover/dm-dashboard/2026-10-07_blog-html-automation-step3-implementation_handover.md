# Handover — Blog HTML Automation Step 3 Implementation

Date: 2026-10-07 (updated same day, multiple follow-on passes)
Status: **Implemented, both known issues (word count, HTML QA false-positive) root-caused and
fixed, live-verified against real data. Closure written for that point -- see
`closure/dm-dashboard/2026-10-07_blog-html-automation-step3_closure.md`. Three further feature
additions happened AFTER that closure (keyword suggestions, QA-fix/meta/history UI, reference-
blog structure match, documented below) -- not yet covered by a closure of their own; the
original closure's "COMPLETE" verdict applies only to the scope it describes, not these later
additions.**

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

## Added this pass (2026-10-07, same day) — keyword suggestions

Reordered the form: Collection URL now comes before Main keyword. New "Suggest Keywords" step
in between: parses the collection handle from the URL (generic regex, no hardcoded domain),
fetches the real Shopify collection title, derives one candidate via `faq_schema`'s existing
`primary_keyword_for()`, and finds real high-click GSC queries overlapping the title's
significant words (generalized the existing single-term GSC query into a shared helper). User
picks a suggestion or types their own — nothing auto-decided. Live-tested against a real DE
collection: real title, a title-derived suggestion, and 2 real German GSC queries returned.
Pushed as commit `8730af2`.

## Fixed this pass (2026-10-07, same day)

- **Word count** -- root cause: a single "write ~1500 words" call is a weak self-pacing
  instruction. Fixed by switching to section-level generation (one call per intro + outline
  section, each with its own target, plus a bounded top-up pass). Live-verified: body copy
  886 -> 1060 words for the same real inputs; the full rendered page (what QA actually checks)
  now passes the 1350-1650 range.
- **HTML tag-balance QA false positive** -- root cause: the heuristic counted `<img>` (a void
  element, never closed in valid HTML) as an unclosed opening tag, and the page's own required
  3-5 images reliably tripped the threshold. Confirmed this was a heuristic bug, not malformed
  generator output, before fixing. Fixed by excluding standard void elements from the count --
  confirmed genuinely broken HTML still correctly fails.

Both fixes pushed to `dev-work` (commit `1aa6001`).

## Added this pass (2026-10-07, same day) — QA fixes, meta generation, clickable history/detail view

Per explicit request: "need fix button also when a fix and apply need to update that html and
meta title and dec also need to genrate... every changes and fixed need to store... also need
clickable after publish, view changes, detailed view." Delivered:

- **Review-then-apply Fix buttons** for the 2 fixable QA failures, same pattern Blog Optimization
  already proved. "Images (3-5)": deterministic (no AI) — caps rendered `<img>` tags to the
  limit (root cause: `PRODUCT_COUNT_MAX=6` always exceeds `IMAGE_COUNT_MAX=5` when every product
  card has one image). "Word count": narrow AI call that tightens only the single longest
  paragraph, not a full regenerate.
- **Meta title/description are now actually generated** (previously always `not_checkable`) via
  `generator.generate_meta()`, length-enforced through the existing shared `seo_limits.py`.
- **New table** `blog_html_automation_fix_log` persists every applied fix (mirrors
  `blog_optimization_fix_log`'s exact shape); new `meta_title`/`meta_description` columns on the
  generation table. `qa.py`'s two meta checks now validate the real stored values once generated.
- **History rows are now clickable**, including after a generation is Published (not locked) —
  opens a full `GenerationWorkspace` detail view (HTML code/preview, QA + fixes, meta
  generate/apply, publish/republish) fetched fresh by generation id. One reusable component, used
  both right after a fresh generation and when viewing history — not duplicated.

Pushed as commit `875725c`.

## Added this pass (2026-10-07, same day) — structure matched to a real reference blog

User pointed at a real live blog (`ledsone.co.uk/blogs/new/led-panel-lights-vs-downlights`) and
asked the generator to match its structure and depth. Fetched and analyzed it, found concrete
gaps, closed every one:

- **H3 subsections** — `outline.py` now splits a topic group with 3+ real items into H3
  subsections under one H2 (matches the reference's room-by-room guide), each grounded in a real
  GSC/AEO query, not invented.
- **Bullet highlights** — each section prompt now asks for 2-4 short bullet lines after the
  paragraph, parsed into real `<ul><li>`.
- **Real comparison table** — deterministic (no AI) Product/Price table built from the already-
  fetched product list. Deliberately NOT an AI-written feature-comparison table (e.g. "light
  spread," "best for") — that would require claims this system can't verify under its own "never
  invent product specs" rule.
- **Labeled "Shop the Range" block** — heading + lead sentence before the product grid, instead
  of cards dropped in with no context.
- **Labeled "Final Thoughts" conclusion** — new short AI-written wrap-up paragraph under a real
  heading, replacing one generic static CTA sentence used every time.
- **Locale-aware label text** (German/French) for all of the above, derived from the same
  `localeInstruction` signal `faq_schema` already computes — no new store/domain config.
- **Business rules raised to match the reference's real numbers** (explicit, confirmed change):
  `WORD_COUNT_TARGET` 1500 → 2200, `FAQ_COUNT_MAX` 8 → 9.

Pushed as commit `f6b3b24`.

## Remaining, explicitly open (not silently resolved)

- **No live browser click-through performed.** No browser automation tool was available in this
  session (confirmed via tool search). Honestly recorded as NOT CHECKABLE, with an 8-step manual
  verification checklist written into the validation doc for whoever has browser access next.
- **"Collection URL vs. blog post" relationship remains genuinely unconfirmed.** Searched the
  original Dilaksi requirement text, Step 1 audit, and Step 2 architecture -- none explicitly
  define this. Current implementation treats it as a context input for sourcing real
  products/images for a new blog post (not collection-page content generation). This is
  PRESERVED as-is, not changed, and explicitly marked NOT CONFIRMED rather than silently assumed
  resolved. A quick confirmation from Dilaksi would close this out.
- **DE Shopify blog-content read is still blocked** (the `read_content` scope gap, unrelated to
  this fix pass) -- product/image/GSC inputs work for DE; anything needing to read EXISTING DE
  blog content does not. Not exercised by this feature's generation flow (which only writes new
  content).
- **Internal Linking suggestions remain single-store** -- correctly surfaced as `partial`, not
  fixed by this implementation (explicitly out of scope, carried forward from Step 1/2).
- **Outline planning stayed fully deterministic** (no LLM call) -- works correctly, can be
  revisited later if richer topic naming is wanted.

## Current status

Backend fully live-verified including both fixes. Frontend compiles and follows the confirmed-
working API contract. Per the task's own closure rule, both remaining open items are explicitly
permitted to close when "honestly documented" rather than fully resolved -- both are documented
above, not invented or silently assumed away. **Closure written** -- see the closure document for
the final word.

## Next step

Whoever next has browser access: run the 8-step manual verification checklist in the validation
doc. Confirm the Collection URL interpretation with Dilaksi when convenient -- not blocking, but
worth closing out.

## Technical owner

Kuberan (per this repo's existing AIOS convention -- `CLAUDE.md`'s "File naming" and the
established pattern across every other dm-dashboard handover record in this folder).
