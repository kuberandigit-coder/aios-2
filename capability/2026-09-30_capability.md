# Capabilities — 2026-09-30

## Capability — DC Voltage "Model" Collection/Product Template Pattern

**Date:** 2026-09-30
**Owner:** Kuberan (Validator), requested by Anna (MD) on behalf of Muguntha (owner/approver)
**Store:** dcvoltage.co.uk
**Status:** Built and validated on a duplicate theme (Phase 1a), confirmed later in active live
use on 2026-10-08

### Capability

A dedicated Shopify theme section + template pair (`model-collection-e27.liquid`,
`model-product-specs.liquid`, assigned via `collection.e27-model.json`/`product.e27-model.json`)
built as an explicit, reusable **"model" pattern for future B22/E14 pages** — not a one-off E27
page — giving a collection/product category its own structured-data-rich, metafield-driven
template instead of hand-editing the shared default template.

### What problem it solves

The default Shopify product/collection templates are shared across every product/collection of
that type — any change to them is site-wide. This pattern gives one specific category (E27 bulbs,
and by design any future B22/E14 equivalent) its own template, scoped safely, without touching the
shared default.

### Technical implementation

- Duplicated the live theme ("Tinker 0.1" → "Tinker - E27 model DRAFT") to build and validate
  without affecting the live site, per the project's standing build-on-duplicate rule.
- 2 new theme sections: `model-collection-e27.liquid` (Intro: H1/subheading/direct-answer/quick
  links; Details: shape-comparison table, FAQs, breadcrumb, JSON-LD) and `model-product-specs.liquid`
  (spec table, compare-wattages table, compatibility note, FAQs, JSON-LD in "Supplement" mode).
- 17 metafield definitions (14 product-level, 3 variant-level) with real source-of-truth values
  entered for the pilot product, checked against the sourcing document rather than guessed or
  copied from a different store.

### Reusable QA checklist (9 real bugs found during this build's own validation)

A genuinely reusable list of failure modes to check for when building any similar
metafield/schema-heavy Shopify template: a Shopify schema error from an option label over 50
characters; quick-links pasted as raw URLs instead of hyperlinks; content rendering flush-left
because the theme's real devtools-confirmed content width wasn't used; a text box capped too
narrow; a listing-code typo; two metafield values swapped; a table row mislabeled with the wrong
product's data; **a live category metafield showing two incompatible fitting types on a
single-fitting product — the same bug class the sourcing document cites as having already caused a
real customer return**; and a live category metafield showing the wrong shape value (flagged, not
blocking).

### Originating task

`closure/dcvoltage/2026-09-30_e27-model-phase1a_closure.md`

### Confirmed still in active use (2026-10-08)

This exact template pair is the one extensively edited throughout the 2026-10-08 E27 Batch 2 work
(breadcrumb, complementary products, buy-box reorder, discount removal, delivery line — see
`evidence/dcvoltage/2026-10-08_e27-batch2-quickfixes.md`) — not a one-off build that was never
touched again.

### Limitations

Governance rule discovered the same day as a side effect of this build: **nothing publishes
without Muguntha's written approval** (the sourcing document's rule A9) — any future use of this
template pattern for B22/E14 should expect the same approval gate, not a direct publish.
