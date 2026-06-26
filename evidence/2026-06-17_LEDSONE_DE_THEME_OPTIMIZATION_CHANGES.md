# Ledsone.de — Theme Optimization Changes (LCP)

| | |
|---|---|
| **Project** | Kuberan Workstream — Performance |
| **Store** | Ledsone.de |
| **Date** | 17/06/2026 |
| **Status** | Changes prepared; safe set good; #3 reverted; not yet published |

## What was changed (11 ready edits, exact code provided)

| # | File | Change | Verdict |
|---|---|---|---|
| 1 | `sections/responsive-banner.liquid` (264–287) | `<picture>` + responsive `srcset` (kills double download) | KEEP — main LCP win |
| 2 | `sections/responsive-banner.liquid` (41–48) | Remove `display:none` toggles | KEEP |
| 3 | `snippets/head-assets.liquid` (323–326) | Defer animations/vendor/base.css | **REVERTED — broke layout** |
| 4 | `layout/theme.liquid` (26) | Remove icon-font preload | KEEP |
| 5 | `layout/theme.liquid` (28–32) | Remove Shoplift preload | KEEP |
| 6 | `layout/theme.liquid` (110→218) | Move Swiper to body end | KEEP |
| 7 | `layout/theme.liquid` (55–61) | Delay Clarity to idle | KEEP |
| 8 | `snippets/logo.liquid` (64,144) | Logo lazy → eager | KEEP |
| 9 | `snippets/header.liquid` (4) | Remove duplicate preconnect | KEEP |
| 10 | `snippets/head-assets.liquid` | Google Poppins 3→1 request | Optional |
| 11 | `sections/responsive-banner.liquid` (top) | Hero image `<link rel=preload as=image>` | KEEP — last safe win |

## Key event — Change #3 broke rendering
Applying the `base.css` defer left the page unstyled (stacked announcement bar, unstyled currency list, floating chat) because `critical.css` (264 lines) does not cover above-the-fold styles. **Action: reverted #3** to original render-blocking `stylesheet_tag` lines. Page renders normally again.

## Safe path for #3 (future)
Move above-fold rules (body, header/nav, announcement, `.banner-…` hero) from `base.css` into `critical.css` FIRST, then defer `base.css`. Not done yet — careful manual task.

## Items provided as method (blind code unsafe)
- Critical-CSS inlining (enables #3 safely)
- Remove unused bundled fonts (GTWalsheimPro/GeneralSans/AmericanaTOT) after grep-verifying unused
- Desktop logo PNG → WebP/SVG (theme setting)

## Items needing live data (deferred)
- theme.js (207KB) code-split / INP work
- Loox / Judge.me deferral

## Artifacts produced
- Updated theme copy: `Desktop\ledsone.de 2\` + valid Shopify zip `Desktop\ledsone-de-2-valid.zip` (forward-slash paths; earlier zips failed Shopify's "missing layout/theme.liquid" due to backslash paths).
- Manual change guide delivered against the fresh `Desktop\DE\` theme (identical line numbers).

## Notes / safety
- Customer was editing the **Active (live)** theme directly — advised to duplicate and test on an unpublished theme first.
- Nothing pushed to the live store by me. Recommended workflow for direct edits: Shopify CLI (`shopify theme pull` → edit → `shopify theme push --unpublished`); customer authenticates in their own browser.

## Outcome
Biggest LCP lever (single right-sized hero via `<picture>` + preload) ready and safe. Full set will move LCP toward the 2.0–2.5s range; final confirmation pending a live PageSpeed re-test after publishing the unpublished test theme.
