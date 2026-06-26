# Performance Issues — File-by-File Findings

**Store:** ledsone.de | **Date:** 2026-06-09

---

## layout/theme.liquid

### Issue 1 — Duplicate CSS Preload + Stylesheet Load
**Impact:** HIGH  
**Lines:** 32–45 (preload) + head-assets.liquid lines 313–323 (reload)

The following files are preloaded with `rel="preload" as="style"` in `theme.liquid`, then loaded again as blocking `<link rel="stylesheet">` via `stylesheet_tag` in `head-assets.liquid`:

- `reset.css` (31KB)
- `bootstrap-grid.css` (25KB)
- `utilities.css` (23KB)
- `animations.css`
- `vendor.css` (47KB)

**Root cause:** The preload pattern was added to defer CSS, but the original `stylesheet_tag` calls in `head-assets.liquid` were never removed. Shopify browsers handle the duplicate differently from desktop — on some mobile browsers both requests complete as separate downloads.

**Fix:** Remove the `rel="preload"` lines from `theme.liquid` (lines 32–45) since the actual `stylesheet_tag` calls in `head-assets.liquid` already handle loading. OR remove the `stylesheet_tag` calls and complete the async pattern by adding `onload` to each.

---

### Issue 2 — Microsoft Clarity Script is Synchronous (Render-Blocking)
**Impact:** HIGH  
**Lines:** 69–75

```liquid
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){ ... })(window, document, "clarity", "script", "py88ky947l");
</script>
```

No `async` or `defer` attribute. This script blocks the HTML parser — nothing below it renders until this script completes loading and executing.

**Root cause:** Pasted in as-is from the Clarity dashboard without adding async.

**Fix:** Add `async` to the Clarity snippet (see CODE_FIXES.md).

---

### Issue 3 — Two Sections Rendered AFTER `</html>`
**Impact:** HIGH  
**Lines:** 368–375 (after the closing `</html>` on line 259)

```liquid
{% section 'recent-orders2' %}
{% section 'new-arrivils' %}
```

These sections are rendered completely outside the valid HTML document. Browsers recover, but this:
- Confuses HTML parsers and may cause extra reflows
- Makes these sections render after the document is "complete"
- Causes sections to appear in the DOM in unexpected positions

**Root cause:** Sections were added at the end of the file without noticing the `</html>` had already closed.

**Fix:** Move both `{% section %}` calls to inside the `<body>` before `</body>`.

---

### Issue 4 — Duplicate `cdn.shopify.com` Preconnect
**Impact:** LOW  
**Lines:** 24 and 105

```html
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>  <!-- line 24 -->
...
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>  <!-- line 105 -->
```

Duplicate — browsers ignore the second one but it's unnecessary noise.

**Fix:** Remove the second occurrence at line 105.

---

### Issue 5 — LCP Hero Image Preload is Hardcoded
**Impact:** MEDIUM  
**Lines:** 197–204

```html
<link rel="preload" as="image"
  href="https://ledsone.de/cdn/shop/files/image_69.webp?v=1772614952&width=1200"
  ...>
```

This hardcoded preload only helps when this exact image is the LCP on the page. On collection pages, product pages, or blog pages, this preloads an irrelevant image, wasting bandwidth.

**Fix:** Wrap in `{% if template.name == 'index' %}` so it only fires on the homepage.

---

### Issue 6 — `blueskytechco.ttf` Preloaded (Wrong Format)
**Impact:** LOW  
**Line:** 46

```html
<link rel="preload" href="{{ 'blueskytechco.ttf' | asset_url }}" as="font" type="font/ttf" crossorigin>
```

`.ttf` is a legacy format. The repo also contains `blueskytechco.woff` and `blueskytechco.woff2`. Modern browsers use `.woff2` first. Preloading `.ttf` forces a legacy format download even when browsers would use `.woff2`.

**Fix:** Change to preload `.woff2` format.

---

### Issue 7 — GTM noscript Tag Commented Out
**Impact:** LOW  
**Lines:** 209–214

The GTM noscript iframe tag is commented out. This reduces GTM coverage for users with JavaScript disabled and is a GTM best practice requirement.

**Fix:** Uncomment the GTM noscript and place it immediately after `<body>`.

---

## snippets/head-assets.liquid

### Issue 8 — Google Fonts Load All 12 Weight Variants
**Impact:** MEDIUM  
**Lines:** 37–39, 79–81, 121–123

```liquid
{{ fnt_body_gg | strip | replace: ' ', '+' }}:300,300i,400,400i,500,500i,600,600i,700,700i,800,800i
```

Every Google Font is requested with 12 variants (6 weights + italic versions of each). Unless the theme explicitly uses all 12 variants, most are downloaded but never rendered — pure wasted bandwidth.

Typical usage: regular (400), medium (500 or 600), bold (700) — that's 3 variants, not 12.

**Fix:** Reduce font weight list to only what the theme uses (see CODE_FIXES.md).

---

### Issue 9 — `judgeme-reviews.css` Loaded on All Pages
**Impact:** LOW  
**Line:** 325

```liquid
{{ 'judgeme-reviews.css' | asset_url | stylesheet_tag }}
```

This CSS is loaded on every page (cart, account, blog, 404, etc.) even though Judge.me reviews only appear on product and potentially collection pages.

**Fix:** Conditionally load based on template:
```liquid
{%- if template.name == 'product' or template.name == 'collection' -%}
  {{ 'judgeme-reviews.css' | asset_url | stylesheet_tag }}
{%- endif -%}
```

---

### Issue 10 — CSS Loading Order Issue
**Impact:** MEDIUM  
**Lines:** 313–324

`critical.css` (7KB) is loaded correctly first — good. However `base.css` (165KB, unminified) is loaded as a blocking stylesheet with no async strategy. Combined with `reset.css` (31KB), `vendor.css` (47KB), `animations.css`, `utilities.css` — total blocking CSS on page load exceeds **300KB**.

**Fix:** Minify `base.css`. Consider moving non-critical rules (print, RTL, animations) out of blocking path.

---

## snippets/scripts-tag.liquid

### Issue 11 — All Core JS Loaded on Every Page
**Impact:** HIGH  
**Lines:** 14–16

```liquid
<script src="{{ 'shopify.js' | asset_url }}" defer="defer"></script>
<script src="{{ 'theme.js' | asset_url }}" defer="defer"></script>   <!-- 207KB -->
<script src="{{ 'product.js' | asset_url }}" defer="defer"></script>  <!-- 82KB -->
```

`product.js` (82KB) is loaded on every page — collection, blog, account, 404, cart — even though product-specific functionality (variant selection, media gallery, etc.) only applies on product pages.

**Root cause:** JS was not split by page type.

**Fix:** Move `product.js` inside the `{%- when 'product' -%}` case block.

---

### Issue 12 — `drift.min.js` on All Product Pages
**Impact:** LOW  
**Lines:** 19

```liquid
{%- when 'product' -%}
  <script src="{{ 'drift.min.js' | asset_url }}" defer="defer"></script>
```

Drift (16KB) is loaded on every product page. If Drift (image zoom library) is only used for certain product layouts or is deprecated, this is unnecessary weight.

**Fix:** Confirm if Drift is actively used. If not, remove. If yes, lazy-load it only when the zoom interaction is triggered.

---

## snippets/product-item.liquid

### Issue 13 — Multiple Nested Loops Over `product.variants` Per Card
**Impact:** HIGH  
**Lines:** 58, 116, 152, 161, 312, 677

```liquid
for variant in product.variants limit: 1   -- line 58
for v in product.variants                   -- line 116
for v in product.variants                   -- line 152
for v in product.variants                   -- line 161
for variant in product.variants limit: 1   -- line 312
for variant in product.variants            -- line 677
```

Six separate loops over `product.variants` in a single snippet that renders for every product on a collection page. A collection with 24 products runs these loops 144 times per request.

**Root cause:** Logic for stock availability, pre-order status, price, and colour was added incrementally without consolidating into a single loop.

**Fix:** Consolidate all variant logic into one loop and assign all needed variables in a single pass (see CODE_FIXES.md).

---

### Issue 14 — `scrolling-text.css` Loaded Inside Product Item Snippet
**Impact:** MEDIUM  
**Line:** 1

```liquid
{{ 'scrolling-text.css' | asset_url | stylesheet_tag }}
```

This is at line 1 of `product-item.liquid`. Shopify deduplicates CSS, but calling `stylesheet_tag` inside a snippet renders a `<link>` tag into the page body (not `<head>`), which is invalid HTML and can block rendering mid-page on some browsers.

**Fix:** Move this `stylesheet_tag` call to `head-assets.liquid` or load it conditionally in the section that renders product items.

---

## snippets/responsive-image.liquid

### Issue 15 — No `fetchpriority` Attribute on LCP Images
**Impact:** MEDIUM  
**Line:** 75

```liquid
<img
  srcset="..."
  loading="lazy"
  ...
>
```

All images use `loading="lazy"`. There is no mechanism to set `fetchpriority="high"` on the first/hero image on any page. For collection pages and the homepage, the first product image or banner is the LCP element and should not be lazy-loaded.

**Fix:** Accept a `priority` parameter in the snippet and conditionally apply `loading="eager" fetchpriority="high"` for the first image per page.

---

## sections/main-product.liquid

### Issue 16 — Three CSS Files Loaded in Section Header
**Impact:** MEDIUM  
**Lines:** 1–3

```liquid
{{ 'product-details.css' | asset_url | stylesheet_tag }}   -- 42KB
{{ 'product.css' | asset_url | stylesheet_tag }}            -- 50KB
{{ 'photoswipe.css' | asset_url | stylesheet_tag }}
```

92KB+ of additional CSS injected into the body by the section. While Shopify renders section CSS in the head, this is still 92KB of page-specific CSS on top of the 300KB+ already in `head-assets.liquid`.

**Fix:** These are acceptable for product pages. Ensure they are NOT duplicated by product-recommendations or other sections on the same page.

---

## sections/product-recommendations.liquid

### Issue 17 — Duplicate `product.css` Load
**Impact:** MEDIUM  
**Line:** 1

```liquid
{{ 'product.css' | asset_url | stylesheet_tag }}
```

`product.css` is already loaded by `main-product.liquid` on the same product page. Shopify will deduplicate in the rendered HTML, but this pattern signals that CSS ownership is unclear across sections.

---

### Issue 18 — IntersectionObserver rootMargin Too Aggressive
**Impact:** LOW  
**Lines:** 103–105

```javascript
const observer = new IntersectionObserver(this.handleIntersection, {
  rootMargin: '0px 0px 1200px 0px',
});
```

`1200px` below viewport means recommendations are fetched when the user is 1200px away — often triggered immediately on page load even before the user scrolls. This adds a fetch request before the page is even interactive.

**Fix:** Reduce to `200px` or `400px` to trigger fetch closer to actual scroll position.

---

## sections/main-collection-product.liquid

### Issue 19 — `content_for_header` Captured to Parse URL
**Impact:** MEDIUM  
**Lines:** 4–6

```liquid
{%- capture contentForQuerystring -%}
  {{ content_for_header }}{%- endcapture -%}
```

Capturing `content_for_header` to extract the page URL from it is a known Shopify anti-pattern. `content_for_header` is a complex render that returns all app script injections, meta tags, and script tags. Capturing it just to string-split the URL significantly increases Liquid render time.

**Fix:** Use `request.path` and `request.query_string` instead — they are native Liquid objects available in OS 2.0.

---

## assets/base.css

### Issue 20 — 165KB Unminified CSS Loaded Globally
**Impact:** HIGH

`base.css` is 165,564 bytes unminified. Minification alone typically saves 20–30%, bringing it to ~115–130KB. It is also loaded on every page including simple pages like 404, password, account.

**Fix:** Minify `base.css`. Use a build tool (Parcel, esbuild, or even online minifier) to produce a `base.min.css`.

---

## assets/swiper-bundle.min.css

### Issue 21 — Swiper CSS File is 0 Bytes (Empty)
**Impact:** HIGH

`swiper-bundle.min.css` exists but is completely empty (0 bytes). Swiper JS (`swiper-bundle.min.js`, 143KB) relies on its CSS for layout. Without it:
- Carousels have no width/height constraints during JS init
- Layout shifts occur as Swiper JS initialises and repositions elements
- This directly causes CLS

**Fix:** Replace with the correct Swiper CSS file from the Swiper version in use (check `swiper-bundle.min.js` header for version number).

---

## assets/ — Font Files

### Issue 22 — 5 Custom Font Families Bundled
**Impact:** MEDIUM

The assets folder contains fonts from 5 different custom font families:
- AmericanaTOT (Regular, Bold, Italic)
- Binerka Demo
- GTWalsheimPro (Regular, Medium, Bold)
- GeneralSans (Regular, Medium, Semibold, Bold)
- RoyalAgustine

Additionally `blueskytechco` (icon font) in `.eot`, `.svg`, `.ttf`, `.woff` formats.

If only one or two of these are actively used in `settings_data.json`, the rest are dead weight in the repo (though not loaded unless referenced in CSS).

**Verify:** Check `settings_data.json` and `define-custom-font-*.css` files to confirm which families are actually used.

---

## templates/ — Proliferation of Liquid Page Templates

### Issue 23 — 40+ Custom Liquid Page Templates
**Impact:** MEDIUM (TTFB)

There are 40+ `.liquid` page templates (vs JSON templates). Liquid page templates are evaluated server-side on every request. JSON templates serve static JSON that's cheaper to render. Many of these are SEO landing pages that appear to contain inline `{% section %}` calls with product loops.

**Examples:**
- `page.led-beleuchtung.liquid`
- `page.pendelleuchten.liquid`
- `page.led-gluhbirne.liquid`
- `page.bestseller-beleuchtung.liquid`

**Fix:** Convert Liquid page templates to JSON + section where possible. At minimum, avoid inline product loops in Liquid templates.

---

## sections/new-arrivals.liquid vs sections/new-arrivils.liquid

### Issue 24 — Duplicate Section with Typo Name
**Impact:** LOW

Both `new-arrivals.liquid` and `new-arrivils.liquid` (typo) exist. One appears to be a duplicate. The theme.liquid also renders `{% section 'new-arrivils' %}` (the typo version) after `</html>`.

**Fix:** Remove the duplicate. Fix the reference in theme.liquid.
