# Evidence — DC Voltage E27 "Next Level" Quick Fixes

**Date:** 2026-10-02
**Store:** dcvoltage.co.uk
**Requested by:** LED Sone <ledsoneuk@gmail.com>, 1 Oct 2026 4:35 PM, attachment
`Kuberan_E27_next_level_2026-10-01 (2).txt`
**Deadline:** Friday 2 October, 18:00 Sri Lanka time
**Approvers:** Thuwaraga (product content/facts), Muguntha (site-wide/structural)

## What was requested

9 quick-fix items from a 32-task "next level" list, all due today: **C1, C3, C4, P1, P2, P5,
G1, G2, G3**. Full screenshot evidence saved in
`dcvoltage-e27-model/screenshots/55-*.png` through `65-*.png`, tracking doc at
`dcvoltage-e27-model/DCVoltage_E27_quick-fixes_2026-10-02.md`.

## Fixes applied, one by one

1. **P5** — meta description, product 1025: "Dimmable ST64 E27 LED filament bulb, amber
   glass. 4W 450 lm or 8W 800 lm, 2700K or 2200K, CRI 90+. From £5.49 with free UK delivery
   over £25." Screenshot: `55-meta-description-product-1025-saved.png`.
2. **G2** — meta description, guide: "E27 screws in, B22 pushes and twists, GU10 is a
   two-pin spotlight. See photos, a side-by-side table and how to check your fitting in 10
   seconds." Screenshot: `56-meta-description-guide-saved.png`.
3. **P2** — FAQ 1 on product 1025: raw bracket/arrow link text deleted, "B22 version of this
   bulb" turned into a real link to `/products/vintage-style-led-edison-bulb-lamp-b22`.
   Screenshot: `57-faq1-link-product-1025-fixed.png`.
4. **C3** — collection page: FAQ 2's "E27 vs B22 guide" link fixed the same way (screenshot
   `58-faq2-link-collection-fixed.png`); intro box's manual line breaks removed — confirmed
   via direct test (Backspace at the start of each wrapped line merged it back, proving the
   breaks were literal stored newlines in a plain-text field, not CSS wrapping) — screenshot
   `59-intro-linebreaks-fixed-draft-theme.png`. Built on duplicate theme "Tinker - E27 model
   DRAFT" per the task's own build-on-duplicate rule.
5. **G1** — guide's 3 dead links: "Shop E27 Bulbs" → `/collections/e27-bulbs` (already
   correct, confirmed by Kuberan before this task started); "Shop GU10 Bulbs" and the
   breadcrumb "Bulbs" link both → `/collections/led-bulb` (no GU10 collection exists on the
   site — per the task's own note, this was the documented correct fallback, not a guess).
   Screenshot `60-g1-dead-links-fixed-draft-theme.png`. **Confirmed live independently**: a
   direct fetch of the real public guide page (not the draft theme) showed both target links
   present and correct.
6. **G3** — duplicate H1: the guide's hero heading was a `<h2>` tag styled at 2.4rem/800
   weight to look like a second page title. Changed to a `<div>` with the identical inline
   style (visual appearance unchanged), removing any heading semantics. **Confirmed live
   independently**: a direct fetch of the real public guide page's heading structure showed
   exactly one `<h1>` and no second heading-level element duplicating it.
7. **C4** — sold-out products ~1116 and ~1226 dragged to positions 16 and 17 of 17 in the
   E27 Bulbs collection's manual sort order. Screenshot: `61-c4-sold-out-moved-to-end.png`.
8. **C1** — three parts:
   - (a) Main menu: "E27 Screw Bulbs" → `/collections/e27-bulbs` nested as a dropdown child
     under "LED Bulb" (not a separate top-level item — this took several attempts since
     Shopify's menu editor nests via a drag-up-then-right gesture with no dedicated button;
     the first attempt landed it as a sibling item, caught and corrected before saving).
     Screenshots: `63-c1a-menu-nested-correctly-before-save.png` (structure confirmed correct
     before save) and `64-c1a-menu-nested-confirmed-live.png` (confirmed live afterward, clean
     menu bar, dropdown working).
   - (b) LED Bulb collection page: "Shop E27 (Edison Screw) bulbs" link added, pointing to
     `/collections/e27-bulbs`. Screenshot: `65-c1b-led-bulb-page-link-confirmed-live.png`.
   - (c) Guide's "Shop E27 Bulbs" button — already correct (same as G1's E27 part).
9. **P1** — product 1025 description rewritten. Deleted: the old title heading, both intro
   paragraphs, Key Features list, the full spec table, Package Contents, and the "Important:"
   note (all of it had factual errors — wrong colour temperature claimed for every wattage,
   wrong shape label, US spelling). Replaced with the approved short intro paragraph.
   "Installation & Safety" kept untouched. Screenshot: `62-p1-description-rewritten-saved.png`.

## Approvals received same day

Kuberan confirmed Thuwaraga approved P5, P2, and P1 directly in Shopify (product saved,
visible in the same admin session). C3's draft-theme changes remain pending Muguntha's
sign-off to publish.

## Deliverable sent back

`dcvoltage-e27-model/DCVoltage_E27_Quick-Fixes_Report_2026-10-02.docx` — a Word document
assembling the status table and all 11 screenshots, generated for Kuberan's reply email to
LED Sone.
