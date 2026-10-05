# Closure — DC Voltage E27 "Next Level" Quick Fixes

**Date:** 2026-10-02
**Store:** dcvoltage.co.uk
**Requested by:** LED Sone <ledsoneuk@gmail.com>, 1 Oct 2026 4:35 PM
**Deadline:** Friday 2 October, 18:00 Sri Lanka time
**Follows on from:** [[2026-10-01_blog-r19-fixes_closure]]

## Purpose

LED Sone's follow-up email set a new rule from 1 October: every product now has one
portfolio holder (Thuwaraga for Bulbs) who owns content/facts/prices, and Muguntha owns
site-wide structural items — approval required from the named person before anything goes
live. The attached "next level" task file broke the E27 collection, product 1025, and the
E27/B22/GU10 guide into 32 tasks across 4 batches; today's batch was the first 9 quick fixes.

## What was done

All 9 items (C1, C3, C4, P1, P2, P5, G1, G2, G3) completed within the 18:00 deadline. Full
breakdown in [[2026-10-02_e27-next-level-quickfixes]] (evidence) and
[[2026-10-02_e27-next-level-quickfixes_validation]] (validation).

## Real issues found and fixed along the way (not in original scope, but blocking)

1. **A GitHub Dev Tools merge corrupted the live product's upload path mid-task** (separate
   dm-dashboard incident, not DC Voltage, but discovered the same day — see
   [[2026-10-02_blog-optimization-dev-task_closure]] in the dm-dashboard folder) — unrelated
   to this task but worth noting it didn't block DC Voltage work since they're separate
   repos/stores.
2. **Shopify's menu editor nests sub-items via an undocumented drag gesture.** The first
   attempt at C1a (adding "E27 Screw Bulbs" under "LED Bulb") landed it as a separate
   top-level item instead of nested — caught before saving via screenshot review, corrected
   by dragging up then right (not just up) to trigger the indent.
3. **The collection intro box (C3) turned out to be a plain-text field, not HTML** — manual
   line breaks in it are literal stored newlines, not a rendering artifact. Confirmed by
   testing: pressing Backspace at the start of a wrapped line merged it into the previous
   line's text (losing a space in the process, corrected), proving the fix.
4. **A pasted full-page HTML update (for G1's link fixes) was once pasted into the wrong
   editor mode** (rendered rich-text view instead of the HTML source view), causing visible
   corruption (duplicated heading, raw style fragment shown as text) on the live guide page.
   Caught immediately from the screenshot, undone via Ctrl+Z before it could cause lasting
   damage, and redone via the safer method (click directly on the existing link element,
   edit its URL through the link-edit popup) instead of a full-block HTML paste.

## Evidence / Validation

- [[2026-10-02_e27-next-level-quickfixes]] (evidence)
- [[2026-10-02_e27-next-level-quickfixes_validation]] (validation)
- Daily log: [[2026-10-02_daily-work-log]]
- Full screenshot set: `dcvoltage-e27-model/screenshots/55-*.png` through `65-*.png`
- Status tracking doc: `dcvoltage-e27-model/DCVoltage_E27_quick-fixes_2026-10-02.md`
- Reply package sent: `dcvoltage-e27-model/DCVoltage_E27_Quick-Fixes_Report_2026-10-02.docx`

## Files changed

- Shopify admin: product 1025 (meta description, FAQ link, description), collection page
  (FAQ link, intro text, manual sort order), main menu (new nested dropdown item), LED Bulb
  collection (new link), guide blog post (3 link fixes, H1 fix) — all live edits, not in git.
- `dcvoltage-e27-model/e27-vs-b22-vs-gu10-guide-FIXED.html` and `-INLINE.html` — reference
  copies updated with the same 2 link fixes (G1) and the H1→div fix (G3).
- `dcvoltage-e27-model/C1b_led-bulb-collection_description_corrected.html` — reference copy
  of the LED Bulb collection's updated description.
- `dcvoltage-e27-model/P1_product-1025_description_corrected.html` — reference copy of the
  rewritten product description.
- `dcvoltage-e27-model/C1a_expected_menu_mockup.png` — a generated mockup image showing the
  correct nested-dropdown target state, used to guide the menu-editing steps.

## Status

**Done.** All 9 items complete, 8 confirmed live (2 of those — G1 and G3 — independently
re-verified against the real public page, not just a screenshot), 3 already approved by
Thuwaraga same day. **One item carried forward**: C3 is correct on the duplicate theme but
not yet published — needs Muguntha's sign-off, then a publish step, then re-confirmation.
Reply email drafted and sent to LED Sone with the Word-doc evidence package attached,
confirming completion and proposing the suggested dates (7, 12, 15 October) for the
remaining 23 tasks in the file.
