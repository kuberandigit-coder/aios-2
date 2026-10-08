# Daily Work Log — 2026-10-08

- **dcvoltage — E27 Batch 2 (S3-KUB-02), G6: replaced fixed dates in the blog guide.** Changed
  "Updated May 2026" to "Updated 8 October 2026" and "as of 2025" to "as of October 2026" in the
  guide's HTML. Verified live, screenshots saved. See
  `dcvoltage-e27-model/screenshots/85-batch2-g6-updated-date-live.png`,
  `86-batch2-g6-as-of-october-2026-live.png`.

- **dcvoltage — G4: fixed the E27 guide's structured data (description, author, dateModified,
  FAQPage), after a long live-debugging mystery.** Initial attempt wrote correct, scoped Liquid
  (checked via `article.handle`) and confirmed it was genuinely saved on the live theme (CLI push
  + manual Admin code-editor diff, byte-identical) — yet the public page kept rendering Shopify's
  unmodified default `structured_data` output, with `dateModified` frozen even after resaving the
  article. Root-caused by force-testing the condition true and printing `article.handle` directly
  into the page: it returns the **blog-prefixed** value (`news/e27-vs-b22-vs-gu10-...`), not just
  the slug — the original comparison string was missing the `news/` prefix, so the `if` silently
  never matched. Fixed the comparison to the real handle; confirmed live: description filled,
  author now `Organization` (was `Person`), `dateModified` updates from `article.updated_at`, and
  a 6-question FAQPage schema is present. Confirmed a different blog post still renders Shopify's
  default output untouched, proving the scoping is correct.

- **dcvoltage — P4: breadcrumb, complementary products, and two FAQ/guide links on the E27 Bulbs
  collection.** Added a visible breadcrumb nav + matching `BreadcrumbList` schema (Home > LED
  Light Bulbs > E27 Bulbs > product), generalized from "just product 1025" to the whole collection
  via `product.collections` detection (no hardcoded product list). Set 4 complementary products
  in Search & Discovery, merged the fix into the existing `product.e27-model.json` template
  (removed "New Arrivals", switched to complementary mode), then fixed a 5-column grid leaving an
  empty gap down to 4 columns with proper spacing once only 4 products were confirmed. Linked the
  "6-pack" FAQ answer and added an "E27 vs B22 guide" link under "Will it fit?". Later tightened
  the breadcrumb's own padding/margin per a follow-up layout request. Verified live on two
  different products confirming the collection-wide fix. Screenshots 87-91.

- **dcvoltage — P3: tidied the 1025 buy box.** Reordered blocks so Add to cart appears before the
  "Unlock 10%"/discount-codes boxes (was above it); removed the expired "Spring Sale 15%"/SPRING15
  entry after Muguntha confirmed it should go; added a free-UK-delivery line under the price with
  Muguntha's exact approved wording; updated the 3 variant labels to include lumens/Kelvin per
  Thuwaraga's approval (including a late correction, 8W finalized as "2700K Warm White" not the
  draft "2200K extra warm"). All 4 parts confirmed live via direct page fetch.

- **dcvoltage — C5: collection structured data clean-up.** Trimmed the E27 Bulbs `ItemList` down
  to `position`+`url` only (removed embedded `Product`/`AggregateOffer`/image/price data).
  Added `legalName`, postal address, email and telephone to the site-wide Organization schema
  (also caught and fixed a mismatched `tel:` link on the Contact page that didn't match the
  displayed number). Removed the "1.", "2." ... numbering prefix from the collection's FAQ
  questions, in both the visible accordion and the FAQPage schema. Resolved the "DC Voltage" vs
  "DCVOLTAGE" brand inconsistency once Thuwaraga approved "DC VOLTAGE" — updated the Store name
  setting (covers Organization schema + the e27-model template's brand automatically) and
  bulk-updated all 17 products' Vendor field to match; verified consistent live across multiple
  pages.

- **dcvoltage — P6 (partial): fixed 37 missing `alt` attributes** on the "New Arrivals" carousel's
  variant-thumbnail images (`alt="{{ product.title }}"`), confirmed live, 0 remaining. The rest of
  P6 (new main image, dimension drawing, 10 photo alt-text descriptions) sent to Thuwaraga for
  her input, awaiting reply.

- **dcvoltage — C7 (in progress): built the product-title sheet** for all 17 E27 products,
  pulling live title/handle/SKU/variant data from the storefront JSON endpoint (no Admin API
  access available this session), proposing new titles to the agreed pattern and flagging
  anything not stated anywhere (wattage/Kelvin/dimmable) as TBC rather than guessing. Published
  as a Google Sheet and sent to Thuwaraga for her D9 OK, along with the ~1102 variant rename table
  from the original task file. Awaiting her reply before any live title changes.

- **dcvoltage — C2 (in progress): set up the E27 Bulbs collection filters.** Created 3 new
  "Choice list" metafield definitions (`specs.lumens`, `specs.kelvin`, `specs.shape`) with preset
  values, confirmed the existing `specs.dimmable` (True/false) was already correct, and confirmed
  all 4 Search & Discovery filters are wired to them. Set 1025's own values as a working example.
  Built and sent a second Google Sheet proposing filter values for all 17 products (same TBC
  approach as C7), flagging two open questions for Thuwaraga (1102's mixed-shape handling, whether
  "Decorative" fits 1045's heart shape). Awaiting her reply before filling in the rest.

- **AIOS — housekeeping.** Found 47 stale `vercel/*` deployment-notes files already deleted from
  disk before this session started (not done by me); confirmed with the user they're no longer
  needed and committed the removal alongside today's new files.

Status at end of day: **5 of 8 batch items fully done and verified live** (G6, G4, P4, P3, C5).
Remaining 3 (P6, C7, C2) have every part that needed no approval already done; everything else is
with Thuwaraga, awaiting her reply.
