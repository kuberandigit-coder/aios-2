# Evidence — GA-19 Organic Discovery (DC Voltage Pack)

**Date:** 2026-10-05
**Store:** dcvoltage.co.uk
**Source:** "LEDsone Organic Discovery: Rules, Recommendations and Results Log" (Google Doc, shared 5 Oct 2026 09:09, approved by Muguntha)
**Approver:** Muguntha (all 6 parts)
**Full tracking doc:** `dcvoltage-e27-model/GA19_progress_2026-10-05.md` / `.docx`

## Part 1 — Product title as the H1

Root cause: the theme's `type_preset: h1` setting only applies CSS styling via a class name — the actual HTML tag was hardcoded separately in `templates/product.json`, block `text_GnyQiN`, as `<h3>` for every product except one (which already had a one-off manual `<h1>` fix). A second, independent duplicate came from `sections/product-information.liquid`'s sticky add-to-cart bar, hardcoded as its own `<h3>` on every product including the already-fixed one.

Fixed both: `product.json` text changed `<h3>` → `<h1>`; sticky bar tag changed `<h3>` → `<div>` with a `{% comment %}` block recording who/when/why.

Verified live via raw HTML fetch (not a visual check) on two different products: product 1025 (previously had the duplicate) and product ~1156 (previously had zero real H1 tags at all) — both now show exactly one correct `<h1>`.

Screenshots: `66-ga19-p1-h1-change-code-view-live-theme.png`, `67-ga19-p1-sticky-bar-comment-added-live-theme.png`.

## Part 2 — Show ratings

Judge.me was already installed with 27 real, published reviews (confirmed in its own dashboard — not fake/empty), but the two blocks that display it (`judge_me_reviews_preview_badge`, `judge_me_reviews_review_widget`) were switched off in `product.json`. Enabled both.

Verified live: both `jdgm-prev-badge` and `jdgm-widget` markup present in the fetched HTML of real product pages.

Screenshot: `68-ga19-p2-judgeme-blocks-enabled-code-view-live-theme.png`.

## Parts 3 & 4 — Alt text / Compare-at prices

Set up a new Shopify Admin API token for dcvoltage (none existed before this task) to pull live, current numbers instead of relying on the 2026-09-29 audit. Live pull found the real current counts are higher than the stale audit: 57 compare-at price issues (not 41 — 40 on ACTIVE/live products), 1,356 of 4,196 images missing alt text (not 1,385/3,655 — 134 products affected, 60 with zero alt text on any image).

Full report built with the live breakdown (summary tables + full detail tables) and sent to Muguntha, cc Hethesha and Sajeepan (DC Voltage's ads lead, included since both compare-at prices and product imagery feed ad campaigns). No changes made to either — both are store data, not theme work, per the standing rule in `Kuberan_website_fixes_2026-09-29.docx`.

Deliverable: `dcvoltage-e27-model/Store_Data_Issues_Report_Muguntha_2026-10-05.docx`.
Screenshot: `69-ga19-part3-4-report-emailed-to-muguntha.png` (sent-email confirmation).

## Part 5 — B22 and E14 bulb collections

Verified real product counts via a thorough sweep (titles, descriptions, tags, variant titles, SKUs — not just title matches): 7 genuine B22 bulb products (6 ACTIVE, 1 DRAFT — one, "Dimmable Vintage Industrial LED Lighting Bulbs ~1097," only findable via its variant SKUs, not its title), 1 genuine E14 bulb product store-wide ("Dimmable E14 LED Filament Bulb | Vintage C35 Candle 4W ~1136"). Confirmed the thin E14 count with Kuberan before creating that collection.

Created both collections manually in Shopify admin — products added, SEO title + meta description written to match E27 Bulbs' existing style/length, no collection image (matching E27 Bulbs, which also has none):

- **B22 Bulbs** — `/collections/b22-bulbs-bayonet-cap-led-filament-bulbs-dcvoltage` — 7 products
- **E14 Bulbs** — `/collections/e14-bulbs-small-edison-screw-candle-bulbs-dcvoltage` — 1 product

Verified live: both URLs return 200, correct title and products render.

Screenshots: `70` through `75-ga19-p5-*.png`.

**Follow-up requested and logged:** E27 Bulbs uses a special template (`collection.e27-model.json`) with a header fitting-type nav list, answer-first intro box, quick links, a 7-row shape comparison table, a 6-item FAQ, a breadcrumb, and schema.org structured data output. Kuberan confirmed B22 and E14 should get the same full treatment, content written fresh for each category (not copied from E27). Not yet built — the explicit next step. Screenshot `76-ga19-p5-e27-page-header-nav-and-intro.png` is the reference showing E27's current header nav/intro/quick-links as the target to match.

## Part 6 — Answer-first intro on Wall Light collection

Found Wall Light already has a full content article in its description, but its opening line is descriptive, not answer-first ("Lights on the wall, or sconces as they're often called, are a really neat way..."). Drafted a short answer-first intro to prepend above the existing article, unchanged below it — awaiting Kuberan's final confirmation on wording before publishing. Not yet live.

## Team status update

Replied in the shared "website organic discovery" thread confirming GA-19 as the first task, with Parts 1 & 2 done, Parts 3 & 4 blocked pending Muguntha, Parts 5 & 6 in progress at the time of posting.
