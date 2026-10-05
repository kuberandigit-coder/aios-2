# Organic Discovery — Kuberan's Tasks (Step-by-Step)

Source: "LEDsone Organic Discovery: Rules, Recommendations and Results Log"
(Google Doc, last updated Sunday 4 October 2026, ~20:15 UK time). Approver: Muguntha.

## Status overview

| # | Code | Task | Deadline | Status |
|---|------|------|----------|--------|
| 1 | **KU-01** | dcvoltage E27 batch 1 (C1/C3/C4/P1/P2/P5/G1/G2/G3) | Fri 2 Oct 18:00 SL | ✅ **Done** — see `DCVoltage_E27_quick-fixes_2026-10-02.md`. Doc still shows "past due" — flag to Muguntha so it's marked done. |
| 2 | **GA-19** | dcvoltage pack (6 parts, below) | Start Mon 5 Oct | 🔶 **4 of 6 done** (Parts 1, 2, 5, 6) — Parts 3 & 4 blocked on Muguntha's approval, report sent. See `GA19_progress_2026-10-05.md`. |
| 3 | **KU-02** | dcvoltage E27 batch 2 (C2/C5/C7/P3/P4/P6/P10/G4/G6) | Wed 7 Oct 18:00 SL | ☐ Not started |
| 4 | **KU-03** | dcvoltage E27 batch 3 (C8/C10/C11/P7, then C6/P8/P9) | Mon 12 Oct 18:00 SL | ☐ Not started |

---

## ⚠️ Before you start GA-19: approval gate

`Kuberan_website_fixes_2026-09-29.docx` states twice: **"Never change prices or
compare-at prices without Muguntha's approval"** and names **compare-at prices** and
**alt text** specifically as "store data" needing his OK before bulk-editing — separate
from template/theme work. GA-19's own listing doesn't repeat this, but the rule still
applies.

**Get Muguntha's sign-off before doing Part 3 (alt text) and Part 4 (compare-at prices)
at bulk scale.** Parts 1, 2, 5, 6 are template/structural work, not store data — safe to
start without separate approval.

**Recommended order today:** Part 1 (H1) first — pure template work, matches the doc's
own instruction to do H1 and compare-at prices first, and doesn't need the approval wait.

---

## Part 1 — Product title as the H1 (START HERE)

**What's wrong:** dcvoltage's theme currently prints a separate small heading before the
real H1 (same bug class as P10 in the earlier E27 batch, but site-wide here, not just
product 1025).

**Steps:**
1. Shopify Admin → Online Store → Themes → Edit code (or the duplicate theme if building
   there first, per the "always build on a duplicate theme" rule).
2. Find the product page template/section responsible for the title (likely
   `main-product.liquid` or similar — look for wherever the product title is rendered).
3. Confirm the product's `{{ product.title }}` (or equivalent) is wrapped in a single
   `<h1>` tag, and that no other heading element duplicates it above/before it.
4. If there's a separate "eyebrow" heading printing the title a second time before the
   real H1, remove it (same fix pattern as the earlier P10 task).
5. Save, preview, repeat for a sample of product pages to confirm only one H1 shows.

**How it's checked:** the bot fetches sample product pages and confirms exactly one
`<h1>` containing the product title.

---

## Part 2 — Show ratings

**What's wrong:** 0 of 15 sampled product pages show star ratings today (per the Sept
29 doc's earlier audit — same root issue GA-06 covers site-wide for ledsone).

**Steps:**
1. Confirm which review app dcvoltage uses (check Shopify Admin → Apps for a reviews
   app, e.g. Judge.me, Loox, or Shopify's own Product Reviews).
2. If reviews exist but aren't displaying: add the review app's star-rating snippet/block
   to the product template (theme editor → product template → add block, or edit the
   Liquid template directly if the app doesn't offer a drag-in block).
3. If there are genuinely 0 reviews yet: do NOT fabricate a rating. Per the ES-01 task in
   the same doc, a fixed/fake rating with 0 real reviews is being actively removed
   elsewhere as a known problem — don't introduce the same issue here. Ratings only show
   once real reviews exist.
4. Confirm AggregateRating structured data is present on the product page (view page
   source or use Google's Rich Results Test) once real reviews exist.

**How it's checked:** fetch sample product pages, check for visible rating stars + the
AggregateRating schema.

---

## Part 3 — Alt text on images ⚠️ needs Muguntha's approval first

**What's wrong:** 1,385 of 3,655 dcvoltage images have no alt text.

**Steps (once approved):**
1. Identify the image set: likely a mix of product images and collection/theme images.
   Product image alt text is usually settable per-image in Shopify Admin → Products →
   (each product) → Media → click image → Alt text field.
2. For bulk coverage, a pattern-based approach (product title + variant, same convention
   as GA-11 for ledsone) is faster than manual entry for all 1,385 — confirm with
   Muguntha whether a bulk script is acceptable or whether each needs manual review.
3. Write descriptive, accurate alt text — product name + key distinguishing detail (shape,
   colour, angle). Never invent details not visible in the image.
4. Save and spot-check a sample of updated images.

**How it's checked:** the bot counts empty alt text across the catalogue; target is 0.

---

## Part 4 — Clear wrong compare-at prices ⚠️ needs Muguntha's approval first

**What's wrong:** per the Sept 29 doc, 41 dcvoltage variants show a compare-at price
below the selling price or at £0.00 — a UK consumer-law risk (misleading "was" price).

**Steps (once approved):**
1. Pull the list of affected variants — likely needs a query against Shopify (variant
   `compareAtPrice < price` or `compareAtPrice = 0` while a price exists). Can be done via
   the Shopify Admin API if a list isn't already available from the Sept 29 audit.
2. For each affected variant, decide with Muguntha: either set compare-at price to blank
   (no "was" price shown) or to a genuine prior price if one exists and is verifiable.
   **Do not set compare-at prices without his decision per variant or an agreed rule** —
   this is explicitly called out as price data, not theme work.
3. Apply the agreed change per variant.
4. Re-check the full set afterward to confirm 0 variants still show an invalid compare-at
   price.

**How it's checked:** not explicitly stated in GA-19's row, but logically: re-run the same
compare-at price audit used in the Sept 29 doc, confirm 0 matches remain.

---

## Part 5 — Add B22 and E14 bulb collections

**What's wrong:** these collections don't exist yet on dcvoltage (only E27 does, from the
earlier KU-01/02/03 batches).

**Steps:**
1. Shopify Admin → Products → Collections → Create collection.
2. Name: "B22 Bulbs" (or similar, matching your E27 collection's naming convention) —
   check the existing E27 collection's title pattern first for consistency.
3. Set up automated or manual collection rules to pull in all B22-fitting products
   (same approach used for the E27 collection).
4. Repeat for E14.
5. Per the broader doc's note that these collections "serve as the pattern for later
   pages" (from the Sept 29 doc) — consider reusing the E27 collection's template/intro
   structure once built (FAQ section, shape table, etc.) rather than starting from
   scratch, once KU-02/KU-03 finish building those out further on the E27 page.
6. Add SEO title + meta description for each new collection, matching the style already
   used for the E27 collection (P5's approved meta description is a good reference for
   tone/length).

**How it's checked:** the bot fetches the new collections directly to confirm they exist
and are populated.

---

## Part 6 — Answer-first intro on the wall-light collection

**What's wrong:** no answer-first intro currently on the Wall Light collection (same
"manual line breaks" / plain-text-field issue may apply — check how the E27 collection's
intro box was built in C3, since that turned out to be a plain-text field, not HTML).

**Steps:**
1. Shopify Admin → Products → Collections → Wall Light.
2. Add an intro text block above the product grid (same location/pattern as the E27
   collection's "Which E27 bulb do I need?" box).
3. Write a short, direct answer-first intro — lead with the main buyer question for wall
   lights (e.g. "Which wall light do I need?" or similar), answer in the first 1-2
   sentences, matching the organic standards doc's "answer first" rule (first 2 sentences
   answer the main buyer question).
4. Check whether this field is plain-text or HTML before pasting anything with
   formatting — the E27 collection's intro field turned out to be plain text (manual line
   breaks were literal stored newlines, not markup). Type as one continuous paragraph if
   plain text.

**How it's checked:** not explicitly stated; likely the bot fetches the collection page
and checks for intro text appearing before the first product.

---

## Reference: where things already stand

- Earlier E27 work (KU-01, done) and its screenshots/evidence are elsewhere in this same
  `dcvoltage-e27-model/` folder.
- The full "next level" task file is `Kuberan_E27_next_level_2026-10-01.txt` in this
  folder — KU-02 and KU-03 pull their specific item codes (C2, C5, C7, etc.) from there.
- Full Organic Discovery doc (45 site-wide tasks, most not relevant to you) was pasted
  and read 2026-10-05, not re-saved here in full — say so if it should be archived too.
