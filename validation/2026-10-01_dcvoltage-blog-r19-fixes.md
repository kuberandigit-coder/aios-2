# Validation — DC Voltage "E27 vs B22 vs GU10" Blog R19 Fixes

**Date:** 2026-10-01
**Reviewer:** Kuberan (live screenshots in-session)
**Purpose:** Confirm Mani's 2 flagged R19 items are genuinely fixed live, not just edited locally.

## Checks performed

| # | Item | Method | Result |
|---|------|--------|--------|
| 1 | ST64 ~1025 SEO title updated | Screenshot of Shopify admin product → Search engine listing showing "Dimmable ST64 E27 LED Filament Bulb, Amber ~1025 \| DCVOLTAGE", 60/70 characters, no unsaved-changes banner | PASS |
| 2 | Blog meta description added | Screenshot of Shopify admin blog post → Search engine listing showing the new description, 125/160 characters, green checkmark (saved) | PASS |
| 3 | Blog body renders styled (not plain text) | Screenshot of live blog post showing fonts, orange "Find the Right Bulb in Seconds" CTA box with styled buttons, proper spacing | PASS |
| 4 | Duplicate H1 removed | Code-level: hero heading changed from `<h1>` to `<h2>` with matching inline styles; page's only `<h1>` is now the theme's own blog-post title | PASS (code-verified; not independently re-crawled post-fix) |
| 5 | E27 collection link added | Code-level: "Shop E27 Bulbs" button href confirmed set to `https://dcvoltage.co.uk/collections/e27-bulbs` in the pasted HTML | PASS |
| 6 | FAQPage schema present | Code-level: `<script type="application/ld+json">` with 6 Question/Answer pairs matching the visible FAQ content, appended to the pasted HTML | PASS (not run through Google's Rich Results Test this round — recommend doing so before/after Mani's re-check) |
| 7 | GU10 button | Live screenshot shows "Shop GU10 Bulbs" present; clicking it 404s | Known issue, explicitly out of scope — Kuberan confirmed "leave that 404" |

## Gaps / not independently re-verified

- No fresh Google Rich Results Test run on the live URL after the FAQPage schema was added (the earlier E27
  model task did run Rich Results Test / GSC indexing requests, but that was for the product/collection
  pages, not this blog post). Recommended as a follow-up if Mani's own re-check flags the schema.
- H1 uniqueness was not re-crawled with an external tool (e.g. view-source or an SEO checker) post-fix —
  confirmed only by code inspection of the exact HTML that was pasted and by the rendered screenshot.

## Verdict

**PASS** on both of Mani's flagged items (SEO title, guide fixes) and the real styling bug found and fixed
along the way. GU10 404 explicitly accepted as out-of-scope by Kuberan, not a failure of this task.
