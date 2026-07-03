# Ledsone.de — Core Web Vitals / LCP Performance Investigation

| | |
|---|---|
| **Project** | Kuberan Workstream — Technical SEO / Performance |
| **Store** | Ledsone.de (Blueskytechco multipurpose theme) |
| **Category** | Performance / Core Web Vitals |
| **Date** | 17/06/2026 |
| **Status** | Investigation complete |

## Objective
Determine exactly why Core Web Vitals FAIL on ledsone.de, with the focus on **LCP** (Mobile 3.6s / Desktop 3.8s). INP (166/120ms) and CLS (0.07/0.05) are near-healthy; LCP is the failing metric.

## Method & scope
- PageSpeed `web.dev/analysis` URLs are client-rendered and not reliably fetchable by tooling — Lighthouse opportunity tables were **not** scraped or fabricated. Field data (provided) used for metrics.
- Ground-truth analysis done against the actual theme source code, with file-level evidence.

## LCP element
First homepage section = `responsive-banner` (`templates/index.json` → `responsive_banner_zpn74G`). Its hero image is the LCP element.

## Root causes (file-level evidence)
1. **Hero double-download on mobile** — `sections/responsive-banner.liquid:264-287` renders desktop (2000px) AND mobile (1000px) images, both `eager`+`fetchpriority:high`, toggled by `display:none` (`:41-48`). `display:none` does not stop `<img>` download → mobile fetches both.
2. **Oversized hero, no srcset** — fixed `image_url: width: 2000`, no responsive `srcset`.
3. **~330KB render-blocking CSS** — `snippets/head-assets.liquid:315-326` loads critical, bootstrap-grid, utilities, animations, reset, vendor, **base.css (167KB)** synchronously.
4. **97KB icon font preloaded ahead of LCP** — `layout/theme.liquid:26`.
5. **Shoplift font preload** — `layout/theme.liquid:28-32`.
6. **Above-fold logo lazy-loaded** — `snippets/logo.liquid:64,144`.
7. **Google Poppins requested up to 3×** — `head-assets.liquid` body/heading/menu branches (settings confirm all = Poppins).
8. **Duplicate cdn.shopify.com preconnect** — `theme.liquid:22` + `header.liquid:4`.

## Correction logged
Initial report claimed 3 theme font preloads compete; verified via `settings_data.json` that those are in the Shopify-fonts branch (source='1') and do NOT fire (store uses Google fonts, source='2'). Active preloads are only the icon font + Shoplift.

## Out of reach (no live access)
Real Lighthouse opportunity savings, network waterfall, and third-party (Loox/Judge.me/Clarity) byte/CPU costs require live PSI API/WebPageTest.

## Outcome
Delivered a prioritised (P0–P3) fix plan with exact file/line locations and production-ready code. See companion file [LEDSONE_DE_THEME_OPTIMIZATION_CHANGES.md](LEDSONE_DE_THEME_OPTIMIZATION_CHANGES.md).
