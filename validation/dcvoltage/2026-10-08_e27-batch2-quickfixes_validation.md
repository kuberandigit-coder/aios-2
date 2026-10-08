# Validation — DC Voltage E27 Batch 2 (S3-KUB-02)

**Date:** 2026-10-08
**Reviewer:** Kuberan (live confirmation in-session) + direct `curl` fetch of the public pages for
every "DONE" item, not just screenshots
**Purpose:** Confirm which of the 8 batch items are genuinely live, not just edited locally.

## Checks performed

| # | Item | Method | Result |
|---|---|---|---|
| G6 | Guide dates | Direct fetch of the live guide page, confirmed "May 2026"/"as of 2025" no longer appear, "8 October 2026"/"as of October 2026" present | PASS |
| G4 | Guide structured data | Direct fetch + JSON-LD parse of the live guide page: `description` filled, `author.@type == "Organization"`, `dateModified` matches `article.updated_at`, FAQPage with all 6 questions present. Cross-check: a different blog post still shows Shopify's default output (`Person` author, 2 script blocks, no FAQ) — scoping confirmed not to leak | PASS, independently confirmed live |
| P4a | Breadcrumb | Direct fetch of two different E27 products (1025 and ~1002): both show the 4-step `BreadcrumbList` and visible nav; a non-E27 product (braided cable, same template) correctly shows none | PASS, collection-wide scoping confirmed |
| P4b | Complementary products | Direct fetch of 1025's live page: "You may also need" section shows exactly the 4 approved products (~1227, ~1024, ~1139, ~1097) in a clean 4-column grid, no gap | PASS |
| P4c/d | FAQ "6-pack" link, guide link | Direct fetch, both links present with correct `href` | PASS |
| P3a | Buy box reorder | Direct fetch: discount-box `id="toggle-discounts"` byte position is after the add-to-cart form's byte position in the served HTML | PASS |
| P3b | SPRING15 removed | Direct fetch: 0 matches for "SPRING15"/"Spring Sale" | PASS |
| P3c | Free delivery line | Direct fetch: "Enjoy FREE UK Delivery on orders over £25" present under the price | PASS |
| P3d | Variant labels | Screenshot of the live product page's Type selector showing "4W 450 lm 2700K", "6W 2700K", "8W 800 lm 2700K Warm White" | PASS |
| C5a | ItemList trimmed | Direct fetch of the collection page: `itemListElement` entries contain only `position`+`url`, 0 matches for `"offers"` | PASS |
| C5b | Organization schema | Direct fetch: `legalName`, `address`, `email`, `telephone` all present on the homepage's Organization block | PASS |
| C5c | Brand name | Direct fetch of 1025's `brand.name` and the Organization `name`, plus a second product (1227)'s `brand.name` — all three read "DC VOLTAGE" | PASS |
| C5d | FAQ numbering removed | Direct fetch: FAQ question text no longer starts with "1. "/"2. " etc. | PASS |
| P6d | Carousel alt-text fix | Direct fetch of the homepage, regex count of `variant-thumb` images with/without `alt=` — 37 found, 0 missing | PASS |

## Independent verification method used

Every "DONE" item above was checked by fetching the real, publicly-served page directly (not a
theme-editor preview or an admin screenshot alone) and inspecting the actual served HTML/JSON-LD —
the same stronger method the 2026-10-02 quick-fixes validation established for G1/G3. This was
especially important for G4, where the live theme file was confirmed byte-identical correct
*before* the live page actually reflected it — a screenshot of the admin code editor alone would
have been misleading there.

## Gaps / not independently re-verified

- **P6 (a, b, c), C7, C2**: not yet live — these are sheets/messages sent to Thuwaraga awaiting her
  reply, with no live change to verify yet. Explicitly not claimed as done.
- The exact wording match for free-text fields approved by Muguntha/Thuwaraga (delivery line,
  variant labels) was checked by reading the live text, not an automated diff against the original
  approval message.
- No Google Rich Results Test screenshot was captured for G4/C5 this session (the task file's
  stated proof method) — live JSON-LD was parsed directly instead, which is a stronger technical
  check but not the exact artifact the task asked for. Flagged for Muguntha's sign-off if he
  specifically wants the Rich Results Test screenshot.

## Verdict

**PASS** on 14 of 14 checkable sub-items across the 5 fully-done batch items (G6, G4, P4, P3, C5),
all independently confirmed via direct page fetch, not screenshot-only. **P6, C7, C2 correctly not
claimed as done** — their no-approval-needed parts are complete, the rest is genuinely pending
external input.
