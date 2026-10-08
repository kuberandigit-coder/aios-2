# Evidence — DC Voltage E27 Batch 2 (S3-KUB-02)

**Date:** 2026-10-08
**Store:** dcvoltage.co.uk (backend `rtzv1z-q5.myshopify.com`, theme `154422902945`
"Tinker - E27 model DRAFT" — confirmed this session to actually be the live theme, not a separate
duplicate)
**Requested by:** Website Organic Discovery bot (Telegram), "E27 batch 2 (S3-KUB-02) was due
today, Wed 7 Oct 18:00 SL"
**Deadline:** Reply by Thu 8 Oct 12:00 SL
**Approvers:** Thuwaraga (product content/facts), Muguntha (site-wide/structural)
**Tracking doc:** `dcvoltage-e27-model/Batch2_reply_tracker_2026-10-08.md`
**Checklist source:** `dcvoltage-e27-model/Kuberan_E27_batch2_checklist_2026-10-07.txt`

## 8 items, 5 fully done, 3 in progress

### G6 — Guide dates (DONE)
Changed "Updated May 2026" to "Updated 8 October 2026" and "as of 2025" to "as of October 2026" in
`https://dcvoltage.co.uk/blogs/news/e27-vs-b22-vs-gu10-which-bulb-fitting-do-you-actually-need`.
Screenshots: `85-batch2-g6-updated-date-live.png`, `86-batch2-g6-as-of-october-2026-live.png`.

### G4 — Guide structured data (DONE, after a long live-debugging mystery)
Fixed empty `description`, `Person`-typed `author`, frozen `dateModified`, and missing FAQPage in
`sections/main-blog-post.liquid`, scoped via `article.handle`.

First attempt appeared not to work: code was confirmed byte-identical correct on the live theme
(CLI push success + a theme pull diffed against local = 0 differences), yet the public page kept
rendering Shopify's unmodified default output, with `dateModified` frozen even after resaving the
article (confirmed the page itself IS dynamic — editing the article changed `articleBody`'s length
by exactly the 1 character added — ruling out any caching layer). Root-caused by temporarily
forcing the condition `true` and printing `article.handle` directly into the page: it returns the
**blog-prefixed** value (`news/e27-vs-b22-vs-gu10-...`), not just the slug — the original
comparison string was missing the `news/` prefix, so the `if` silently never matched. Fixed the
comparison to the real handle, removed the diagnostic line, re-verified: description filled,
author now `Organization`, `dateModified` live-updates, 6-question FAQPage present. Confirmed a
different blog post (`steampunk-lighting-ideas`) still renders Shopify's default output untouched.

### P4 — Breadcrumb, complementary products, FAQ/guide links (DONE)
- a) Visible breadcrumb nav + `BreadcrumbList` schema (Home > LED Light Bulbs > E27 Bulbs >
  product), generalized to the whole E27 Bulbs collection via `product.collections` detection
  (`snippets/product-information-content.liquid`, `sections/product-information.liquid`) — not
  hardcoded to one product. Follow-up: tightened the breadcrumb's own padding/margin after a
  layout request (gap between breadcrumb and product image).
- b) 4 complementary products set in Search & Discovery (~1227, ~1024, ~1139, ~1097), merged into
  the existing `templates/product.e27-model.json` (removed "New Arrivals", switched
  `recommendation_type` to `complementary`); fixed a 5-column grid leaving an empty gap once only
  4 products were confirmed, down to a clean 4-column layout.
- c) "6-pack" FAQ answer linked to the pack-6 product.
- d) "E27 vs B22 guide" link added under "Will it fit?".
Screenshots: `87`–`91`.

### P3 — Buy box tidy-up, product 1025 (DONE)
Reordered blocks so Add to cart appears before the discount boxes (was above it); removed the
expired "Spring Sale 15%"/SPRING15 entry (Muguntha approved); added a free-UK-delivery line under
the price with Muguntha's exact wording ("Enjoy FREE UK Delivery on orders over £25"); updated the
3 variant labels with lumens/Kelvin per Thuwaraga's approval, including a late correction (8W
finalized as "2700K Warm White", not the draft "2200K extra warm"). All 4 parts confirmed live via
direct page fetch.

### C5 — Collection structured data clean-up (DONE)
- a) `ItemList` trimmed to `position`+`url` only (removed embedded `Product`/`AggregateOffer`/
  image/price data) in `sections/model-collection-e27.liquid`.
- b) Organization schema (`sections/header.liquid`, site-wide) gained `legalName`, postal address,
  email, and telephone; also caught and fixed a mismatched `tel:` link on the Contact page that
  didn't match the displayed number.
- c) Brand name inconsistency ("DC Voltage" vs "DCVOLTAGE") resolved once Thuwaraga approved
  "DC VOLTAGE" — Store name setting updated (covers Organization schema + 1025's own brand
  automatically) and all 17 products' Vendor field bulk-updated via Admin's bulk editor; verified
  consistent live across multiple products.
- d) FAQ numbering ("1.", "2." etc) removed from both the visible accordion and the FAQPage schema.

### P6 — Images/alt text on 1025 (IN PROGRESS)
- d) Fixed 37 missing `alt` attributes on the "New Arrivals" carousel's variant-thumbnail images
  (`sections/hvc-products.liquid`, `alt="{{ product.title }}"`), confirmed live, 0 remaining.
- a/b/c (new main image, dimension drawing, 10 photo alt-text descriptions) sent to Thuwaraga,
  awaiting reply.

### C7 — Product card titles, all 17 products (IN PROGRESS)
Pulled live title/handle/SKU/variant data via the storefront JSON endpoint (no Admin API access
available this session). Built a proposed-title sheet following the agreed pattern, flagging
anything not stated anywhere (wattage/Kelvin/dimmable) as TBC. Published as a Google Sheet
(`dcvoltage-e27-model/C7_title_sheet_2026-10-08.md` has the same content as reference) with the
~1102 variant rename table from the original task file, sent to Thuwaraga for her D9 OK.

### C2 — Collection filters, all 17 products (IN PROGRESS)
Created 3 new "Choice list" metafield definitions (`specs.lumens`, `specs.kelvin`, `specs.shape`)
with preset values; confirmed existing `specs.dimmable` (True/false) was already correct; confirmed
all 4 Search & Discovery filters wired to them. Set 1025's own values as a working example
(Ambient 300-600lm, Warm white 2700K, ST64, Dimmable Yes). Built and sent a second Google Sheet
proposing values for the other 16 products (same TBC approach), with 2 flagged questions for
Thuwaraga (1102's mixed-shape handling, whether "Decorative" fits 1045's heart shape). 1158/1103
correctly left blank pending separate decisions (D7/D8).

## A real bug found and fixed along the way, not in original scope

The variant-thumb carousel `<img>` tags had zero `alt` attributes across 37 images — this was
folded into P6 part d) since it was explicitly listed in the task file as "no decision needed."

## Deliverable sent back

Telegram reply posted confirming G6/P4/P3/C5/G4 done with links, and that P6/C7/C2's no-approval
parts are done with the rest sitting with Thuwaraga.
