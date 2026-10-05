# Closure — GA-19 Organic Discovery (DC Voltage Pack)

**Date:** 2026-10-05
**Store:** dcvoltage.co.uk
**Owner:** Kuberan
**Source:** "LEDsone Organic Discovery: Rules, Recommendations and Results Log" (Google Doc, approved by Muguntha), shared 5 Oct 2026, 09:09. Piranav owns the ledsone.co.uk tasks on the same doc; Muguntha approves all work.
**Follows on from:** [[2026-10-02_e27-next-level-quickfixes_closure]]

## Purpose

GA-19 is Kuberan's first assigned task from the new shared Organic Discovery doc — a 6-part pack of site-wide SEO/structure fixes for dcvoltage.co.uk, started today (the doc's own instruction: begin Monday 5 Oct).

## What was done

**Part 1 — Product title as the H1 (Done).** Found two separate bugs, both site-wide: the main title block rendered as `<h3>` not `<h1>` for every product except one (which had an earlier one-off manual fix), and the sticky add-to-cart bar duplicated the title a second time as its own `<h3>` on every product. Fixed both in the theme (`templates/product.json`, `sections/product-information.liquid`), pushed live, verified via raw HTML on two different products — exactly one real `<h1>` now, no duplicate.

**Part 2 — Show ratings (Done).** Judge.me was already installed with 27 real published reviews, but the two blocks that display it on product pages were switched off. Enabled both, verified `jdgm-prev-badge` and `jdgm-widget` now render live.

**Part 3 (alt text) & Part 4 (compare-at prices) — Blocked, by design.** Both are store data, not theme work — per the standing rule in `Kuberan_website_fixes_2026-09-29.docx`, neither was touched without approval. Set up a new Shopify Admin API token for dcvoltage (none existed before) to pull live, current numbers rather than relying on the week-old audit: 57 compare-at price issues (not 41), 1,356 of 4,196 images missing alt text (not 1,385/3,655). Sent a full report, with the live breakdown and the two decisions needed, to Muguntha, cc Hethesha and Sajeepan (DC Voltage's ads lead, included since both issues feed ad campaigns).

**Part 5 — B22 and E14 bulb collections (Done, content follow-up requested).** Verified real product counts via a thorough sweep (titles, descriptions, tags, variant titles, SKUs — not just title matches): 7 genuine B22 bulb products (one only findable via SKU, not its title), 1 genuine E14 bulb product. Created both collections live, manually-curated products, SEO title + meta description written to match E27 Bulbs' existing style. Kuberan then confirmed B22 and E14 should also get the same richer content structure E27 Bulbs already has (header fitting-type nav, answer-first intro box, quick links, shape comparison table, FAQ, breadcrumb, schema.org output) — logged as the next step, not yet built.

**Part 6 — Answer-first intro on Wall Light collection (Done).** Found the collection already has a full content article, but its opening line is descriptive, not answer-first, and the article's own `<h1>` duplicated the page's own title heading. Prepended a short answer-first intro above the existing content, downgraded the article's heading to styled (non-heading) text, and rebuilt the FAQ section into a proper accordion. Verified live: one real `<h1>`, intro renders correctly.

## Muguntha's live-site review, same day — 4 gaps found and fixed

After the above was pushed, Muguntha reviewed GA-19 live and replied in the "website organic discovery" thread with 4 real findings:

1. **B22's SEO title** looked filled in in Shopify's admin editor but had never actually saved — the "Page title" box was showing an unsaved placeholder preview, not a real value. Browser `<title>` was falling back to Shopify's auto-generated default. Retyped and re-saved the field; confirmed live via the real `<title>` tag, not the admin preview.
2. **E14's SEO title** — identical root cause, same fix, same verification method.
3. **Wall Light had two real `<h1>` tags** — the collection's own auto-generated title ("Wall Light") and the article's own heading ("Lights on the Wall..."). Already addressed in the Part 6 work above (changed the article's heading to styled text), confirmed live: exactly 1 `<h1>`.
4. **The intro rendered below the product grid, not above it.** Root cause: a shared theme block (`custom_liquid_mMhpBT`) that prints the collection description sits after the grid in the default template, used by every default-template collection on the site. First fix attempt reordered this shared block — which worked for Wall Light but accidentally moved every other collection's description above its own grid too, site-wide. Caught and reverted in the same session before being left live. Correct fix: built `templates/collection.wall-light.json`, a dedicated template for Wall Light only, reusing the same `model-collection-e27` section already proven live on E27 Bulbs (not hardcoded raw HTML — editable via the theme customizer), with the old Title block disabled to avoid a duplicate-H1 risk from the reused section's own heading output. Verified live using Shopify's own section ID markers (not just text position): the intro section's wrapper sits before the grid's wrapper.

B22's 6-vs-7 product count (also flagged by Muguntha) was checked and confirmed expected — 1 of 7 products is still in Draft status, so only 6 show publicly; will appear automatically once published.

All 4 fixes verified live via direct raw-HTML fetch, not the admin/editor view. Reply with proof, plus a full GA-19 status update, ready to post in the thread.

## Real issues found along the way (not in original scope, but directly caused fixes)

1. **The product.json "H1" dropdown setting doesn't actually control the HTML tag at all** — `type_preset: h1/h2/h3` only applies CSS styling via a class name; the real element was hardcoded separately as `<h3>` in the block's text field. Confirmed by reading the theme's own `snippets/text.liquid` rendering logic directly, not assumed.
2. **A second, independent duplicate-heading source** existed in `product-information.liquid`'s sticky add-to-cart bar — unrelated to the main title block, would have kept showing a duplicate title even after the first fix if not found separately.
3. **dcvoltage had no Shopify Admin API access configured anywhere in this project before today** — set up from scratch (custom app, OAuth token generator script matching the existing per-store convention under `shopify-token/`, new env var, new store entry in the backend's shared Shopify client).
4. **A Shopify CLI push attempted to delete `AGENTS.md`, a file that was never actually uploaded** — a harmless no-op error that appeared on every push; confirmed via live HTML re-checks that it never affected the real theme changes.
5. **Wall Light's content doesn't render from its own `descriptionHtml` field reliably across collections** — the default collection template has its description-rendering block disabled; Wall Light's content shows due to what's likely a per-collection customizer override, not the shared template. Worth keeping in mind for any future collection content work beyond GA-19.

## Evidence / Validation

- `dcvoltage-e27-model/GA19_progress_2026-10-05.md` and `.docx` — full detailed progress log, all parts
- `dcvoltage-e27-model/Store_Data_Issues_Report_Muguntha_2026-10-05.docx` — Parts 3 & 4 report sent to Muguntha
- `dcvoltage-e27-model/GA19_Review_Fixes_2026-10-05.docx` — the 4-fix response to Muguntha's live review, with evidence
- `dcvoltage-e27-model/wall-light_description_ORIGINAL_2026-10-05.html` / `_UPDATED_2026-10-05.html` — before/after reference for the Wall Light content edits
- Daily log: [[2026-10-05_daily-work-log]]
- Full screenshot set: `dcvoltage-e27-model/screenshots/66-*.png` through `84-*.png`

## Files changed

- `shopify-themes/dcvoltage/templates/product.json` — H1 fix, Judge.me blocks enabled (Parts 1 & 2)
- `shopify-themes/dcvoltage/sections/product-information.liquid` — sticky bar duplicate-heading fix (Part 1)
- `shopify-themes/dcvoltage/templates/collection.json` — order reverted back to original after the site-wide overcorrection was caught (Part 6 follow-up)
- `shopify-themes/dcvoltage/templates/collection.wall-light.json` — new, dedicated template for Wall Light only (Part 6 follow-up)
- Shopify admin: B22 Bulbs and E14 Bulbs collections created, products added, SEO fields set and re-saved (Part 5 + review follow-up) — live edits, not in git
- Shopify admin: Wall Light collection description content updated, theme template reassigned to `wall-light` (Part 6 + follow-up) — live edits, not in git
- `shopify-token/token-generator-dc.js` — new OAuth token generator for dcvoltage, matching the existing per-store pattern
- `backend/.env` — new `SHOPIFY_DC_ADMIN_TOKEN`
- `backend/app/core/shopify_client.py` — new `"dcvoltage"` store entry

## Status

**Parts 1, 2, 5, 6 done and verified live, including all 4 gaps Muguntha found on live review.** Parts 3 & 4 — Kuberan's side (live data + report) done; the actual fixes reassigned by Muguntha to Sajeepan and Hethesha, deadlines today (Part 4) and 09/10 (Part 3). Part 5's content follow-up (header nav, intro, quick links, shape table, FAQ, schema — matching E27 Bulbs) logged as the next step, not yet started. KU-01's "past due" status in the shared doc still needs flagging to Muguntha.
