# Closure — DC Voltage E27 Model Build (Phase 1a)

**Date:** 2026-09-30
**Site:** dcvoltage.co.uk
**Requested by:** Anna (MD), on behalf of Muguntha (owner/approver)
**Role:** Kuberan — Validator

## Purpose

Build the "model" pattern for future B22/E14 pages: one new E27 bulb
collection page and a rebuilt version of the ST64 ~1025 best-seller product
page, per the LLM-drafted document `Kuberan_website_fixes_2026-09-29.docx`
(Part B, section 3). Every value used was checked against the document's
SOT evidence before being entered — nothing guessed, nothing copied from
ledsone.co.uk.

## Evidence

Full illustrated implementation log (28 screenshots, in the order each step
was actually done in the Shopify admin) plus a copy of the source document:
`dcvoltage-e27-model/dcvoltage-e27-model-task.docx`
`dcvoltage-e27-model/Kuberan_website_fixes_2026-09-29.docx`
`dcvoltage-e27-model/screenshots/` (raw files)
`dcvoltage-e27-model/model-collection-e27.liquid`
`dcvoltage-e27-model/model-product-specs.liquid`

## What was built

- Duplicated the live theme ("Tinker 0.1" to "Tinker - E27 model DRAFT")
- 2 new theme sections: model-collection-e27.liquid, model-product-specs.liquid
- Collection template `e27-model`: Intro (H1, subheading, direct answer,
  quick links) + Details (7-row shape comparison table, 6 FAQs, breadcrumb,
  JSON-LD)
- Product template `e27-model`: H1 fix (was rendering as H3), Model product
  specs section (spec table, compare-wattages table, compatibility note,
  7 FAQs, JSON-LD mode Supplement)
- 17 metafield definitions (14 product-level, 3 variant-level) and real SOT
  values entered for the ST64 ~1025 product (8388218781857) and its 3
  variants (LDMST64E274/276/278)

## Bugs found and fixed during validation (9 total)

1. Shopify schema error — option label over 50 characters
2. Quick links pasted as raw URLs instead of hyperlinked text
3. Content rendering flush-left, no side margins (fixed to the theme's
   real, devtools-confirmed 1440px content width)
4. Answer box capped at 72 characters wide
5. Listing code typo — entered 1035 instead of 1025
6. Size and Pack metafield values swapped
7. Shape table row 1 mislabeled "ST64 squirrel cage" while holding A60 data
8. Live "Bulb cap type" category metafield showed both E27 and B22 on an
   E27-only product — same bug class the source document cites as having
   already caused a real customer return
9. Live "Bulb shape" category metafield still shows "A-shape" instead of
   ST64 — flagged, not fixed (not blocking)

## Status

**PASS** — build complete and validated on the duplicate theme. Preview
links and screenshots (desktop + mobile) sent to Muguntha for written
approval, per the source document's rule A9 (nothing publishes without it).

## Reviewer

Muguntha (pending — approval requested, not yet received)

## Next step

On Muguntha's written OK: create the live "E27 Bulbs" collection (17
listings), add Search & Discovery filters, assign the e27-model templates,
publish the theme, run Rich Results Test on both URLs, request indexing in
GSC. Separately, on his approval: apply the new product title text and the
one approved price change (ST64 6W GBP 8.69 to GBP 5.99).
