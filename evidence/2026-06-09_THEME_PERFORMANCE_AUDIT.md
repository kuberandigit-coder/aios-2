# Shopify Theme Performance Audit
**Store:** ledsone.de  
**Date:** 2026-06-09  
**Auditor:** Claude Code (Senior Shopify Performance Engineer)  
**Theme Stack:** Umino / Custom Shopify OS 2.0 Theme

---

## Executive Summary

The ledsone.de Shopify theme has **significant, fixable performance problems** across every page type. The most severe issues are architectural — duplicate CSS loading, synchronous third-party scripts blocking render, and massive unoptimised JavaScript bundles loaded on every page regardless of need.

The theme is functional but carries the weight of:
- Over **1.7MB of raw CSS + JS assets** served on page load
- **5 CSS files loaded twice** on every page
- A **synchronous blocking script** (Microsoft Clarity) in `<head>`
- **Multiple nested Liquid loops per product card**, running for every card on collection pages
- **165KB of unminified CSS** (`base.css`) loaded globally
- **Sections rendered outside `</html>`** — invalid HTML that can corrupt parsers

These issues combine to produce poor Core Web Vitals, especially LCP and INP.

---

## Performance Score Estimate

| Page Type | Estimated Lighthouse (Mobile) | Primary Blocker |
|-----------|------------------------------|-----------------|
| Homepage | 35–45 | CSS double-load, Clarity, large JS |
| Collection | 25–38 | Liquid render time, product-item loops, CSS |
| Product | 30–42 | 3 CSS files + JS on entry, Swiper, PhotoSwipe |
| Search | 30–40 | Same as Collection |
| Cart | 45–55 | Fewer sections, but global JS still loads |

*Estimates are based on code analysis. Run Lighthouse on a live preview to get exact scores.*

---

## Core Web Vitals Assessment

### LCP (Largest Contentful Paint) — **Critical**
- Hero image preload is hardcoded to a single CDN URL — only benefits one page
- `base.css` (165KB) + double-loaded CSS block CSSOM construction before paint
- No `fetchpriority="high"` on responsive-image LCP images for inner pages
- Google Fonts loaded with many unused weight variants, delaying text paint

### CLS (Cumulative Layout Shift) — **Medium**
- `responsive-image.liquid` uses CSS `aspect-ratio` — good practice
- However, Swiper CSS file (`swiper-bundle.min.css`) is **0 bytes / empty** — Swiper layout may cause layout shifts as JS initialises
- Sections added outside `</html>` may affect browser layout parsing

### INP / FID (Interaction to Next Paint) — **High Risk**
- `theme.js` (207KB, unminified) + `product.js` (82KB) + `swiper-bundle.min.js` (144KB) all load on every page
- Long tasks from JS parsing and execution delay interactivity
- Multiple event listeners registered by multiple separate JS files

### TTFB (Time to First Byte) — **Medium**
- Heavy Liquid render time from:
  - Multiple nested `for variant in product.variants` loops per product card
  - `content_for_header` captured inside section files (anti-pattern)
  - 120+ Liquid section/snippet files evaluated on each request

---

## Bottleneck Analysis

### 1. Duplicate CSS Loading (Critical)
Five CSS files are preloaded in `theme.liquid` AND loaded again as blocking stylesheets in `head-assets.liquid`:
`reset.css`, `bootstrap-grid.css`, `utilities.css`, `animations.css`, `vendor.css`

### 2. Synchronous Clarity Script (Critical)
Microsoft Clarity loads with no `async` or `defer` attribute — fully render-blocking.

### 3. JavaScript Bundle Size (High)
Total JS on product page: ~**830KB raw** (theme.js + photoswipe + swiper + main-product + product + drift + easydlg)

### 4. Liquid Loop Density (High)
`product-item.liquid` runs **5–6 nested loops** over `product.variants` for every single product card. On a collection page with 24 products this is 120–144 variant loop iterations per request.

### 5. CSS per Section/Snippet (High)
`product.css` (50KB) is included by at least 8 different sections/snippets independently. While Shopify deduplicates these, the pattern adds fragility and unnecessary HTTP requests in some contexts.

### 6. Global CSS Weight (High)
`base.css` (165KB unminified) + `vendor.css` (47KB) + `reset.css` (31KB) loaded on every page.

### 7. Empty Swiper CSS (Medium)
`swiper-bundle.min.css` is 0 bytes. Swiper JS (143KB) loads but its CSS is missing — causing layout jank until JS initialises carousels.

### 8. Invalid HTML — Sections Outside `</html>` (Medium)
`{% section 'recent-orders2' %}` and `{% section 'new-arrivils' %}` are rendered after the closing `</html>` tag in `theme.liquid`.

### 9. Font Loading (Medium)
Google Fonts requests load 12 weight variants per font family (300 through 800 including italics). Most are unused.

### 10. content_for_header in Sections (Medium)
Capturing `{{ content_for_header }}` inside section files to parse querystrings is a Shopify anti-pattern that increases Liquid render cost.

---

## Priority Matrix

| # | Issue | Impact | Effort | Priority |
|---|-------|--------|--------|----------|
| 1 | Duplicate CSS loading (5 files loaded twice) | High | Low | P1 |
| 2 | Clarity script blocking render | High | Low | P1 |
| 3 | Sections outside `</html>` | High | Low | P1 |
| 4 | Swiper CSS empty (0 bytes) | High | Low | P1 |
| 5 | Liquid loops in product-item.liquid | High | Medium | P1 |
| 6 | base.css unminified 165KB | High | Low | P1 |
| 7 | JS total weight ~830KB product page | High | High | P2 |
| 8 | product.css loaded in 8+ places | Medium | Low | P2 |
| 9 | Google Font weight variants | Medium | Low | P2 |
| 10 | content_for_header in sections | Medium | Medium | P2 |
| 11 | duplicate cdn.shopify.com preconnect | Low | Low | P3 |
| 12 | new-arrivils typo duplicate section | Low | Low | P3 |
| 13 | judgeme-reviews.css loaded globally | Low | Low | P3 |
| 14 | drift.min.js on all product pages | Low | Low | P3 |
| 15 | LCP preload hardcoded URL | Low | Medium | P3 |
