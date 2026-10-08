# E27 Batch 2 (S3-KUB-02) — Reply Tracker

Reply deadline: Thu 8 Oct 12:00 SL, one line per item in the Telegram group.

| Item | Status | Link / note |
|---|---|---|
| G6 | ✅ DONE | https://dcvoltage.co.uk/blogs/news/e27-vs-b22-vs-gu10-which-bulb-fitting-do-you-actually-need — verified live: "Updated 8 October 2026" + "as of October 2026" both present. Screenshots: `85-batch2-g6-updated-date-live.png`, `86-batch2-g6-as-of-october-2026-live.png` |
| G4 | ✅ DONE | https://dcvoltage.co.uk/blogs/news/e27-vs-b22-vs-gu10-which-bulb-fitting-do-you-actually-need — root cause found: `article.handle` returns the blog-prefixed value ("news/e27-vs-b22...") not just the slug, so the original scoping condition never matched and silently fell through to Shopify's default output (not a caching/app issue as first suspected). Fixed condition to use the real handle. Confirmed live: description filled, author is Organization "DC VOLTAGE", dateModified is fresh (article.updated_at), FAQPage with all 6 questions present. Verified a different blog post (steampunk-lighting-ideas) still shows Shopify's default output untouched -- scoping confirmed correct, no other posts affected. |
| P4 | ✅ DONE | https://dcvoltage.co.uk/products/vintage-style-led-edison-bulb-lamp — a) breadcrumb (visible nav + BreadcrumbList schema, Home > LED Light Bulbs > E27 Bulbs > product) live on 1025 AND collection-wide on ~1002. b) complementary products live: ~1227, ~1024, ~1139 (B22 version), ~1097 (Thuwaraga-approved pendant set), set via Search & Discovery, merged into `product.e27-model.json` (New Arrivals removed, heading "You may also need"), grid fixed to 4 columns (was 5, left a gap) -- confirmed live, clean even layout. c) "6-pack" and d) "E27 vs B22 guide" links both live. Screenshots: `87`-`91` |
| C5 | ✅ DONE | https://dcvoltage.co.uk/collections/e27-bulbs — a) ItemList trimmed to position+url only (no offers/price/image) live. b) Organization now has legalName "DC VOLTAGE UK Ltd", address (Unit 3 Marshbrook Cl, Coventry CV2 2NW), email, telephone (+447923987178, also fixed a mismatched tel: link on the contact page) live. d) FAQ numbering ("1.", "2." etc) removed, live. c) brand name: Thuwaraga approved "DC VOLTAGE" -- Store name setting changed (covers Organization schema + 1025's brand automatically) and all 17 products' Vendor field bulk-updated to match. Verified live on 1025, Organization, and a second product (1227) -- all read "DC VOLTAGE". |
| P3 | ✅ DONE | https://dcvoltage.co.uk/products/vintage-style-led-edison-bulb-lamp — all 4 parts confirmed live via direct page check. a) Add to cart now appears before the discount boxes. b) Spring Sale / SPRING15 fully removed (Muguntha approved). c) "Enjoy FREE UK Delivery on orders over £25" live under the price (Muguntha's exact wording). d) variant labels live: "4W 450 lm 2700K", "6W 2700K", "8W 800 lm 2700K Warm White" (Thuwaraga approved, final 8W wording changed from original 2200K extra warm draft). |
| P6 | 🟡 In progress, waiting on Thuwaraga | https://dcvoltage.co.uk/products/vintage-style-led-edison-bulb-lamp — d) carousel thumbnail alt fix DONE and confirmed live (all 37 variant-thumb images now have alt text, 0 missing). a) new main image, b) dimension drawing, c) 10 alt text descriptions -- message sent to Thuwaraga, waiting for her reply. |
| C7 | 🟡 Step 1 done, waiting on Thuwaraga | Title sheet built for all 17 products + ~1102 variant renames, sent to Thuwaraga 8 Oct: https://docs.google.com/spreadsheets/d/1WgUJV95Q2oHxsPp5TqcHH-MDe6xKVJHNku2g0OKl4lI/edit — several fields marked TBC (wattage/Kelvin/dimmable not in current title/SKU). Waiting on her OK before applying any live title changes. |
| C2 | 🟡 Step 1 + 2 done, waiting on Thuwaraga | Metafield definitions created (specs.lumens, specs.kelvin, specs.shape as Choice list; specs.dimmable as True/false), all 4 filters confirmed wired up live. 1025 already set (Ambient 300-600lm, Warm white 2700K, ST64, Dimmable Yes). Draft value sheet for all 17 products sent to Thuwaraga 8 Oct: https://docs.google.com/spreadsheets/d/1zpDrybX5SQ3V_LQkFXm_OWxu2wsU5eXfeP_N5lrmvKk/edit -- most rows TBC, plus 2 flagged questions (1102 multi-shape, 1045 "Decorative" OK?). 1158/1103 left blank per D7/D8. Waiting on her reply before filling in Admin metafields. |

## Telegram reply draft (update as items finish)

G6 - DONE - https://dcvoltage.co.uk/blogs/news/e27-vs-b22-vs-gu10-which-bulb-fitting-do-you-actually-need
P4 - DONE - https://dcvoltage.co.uk/products/vintage-style-led-edison-bulb-lamp
G4 -
C5 -
P3 -
P6 -
C7 -
C2 -
