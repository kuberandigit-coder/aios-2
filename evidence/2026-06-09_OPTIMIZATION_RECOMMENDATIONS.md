# Optimization Recommendations

**Store:** ledsone.de | **Date:** 2026-06-09  
Expected gains are cumulative. Start with Quick Wins for the biggest return per minute of effort.

---

## Quick Wins (< 30 minutes each)

### QW1 — Fix Clarity Script (Render-Blocking)
**Expected gain:** 200–500ms LCP improvement  
**File:** `layout/theme.liquid` line 69  
**Risk:** None

Add `async` to the Clarity `<script>` tag. See CODE_FIXES.md for exact change.

---

### QW2 — Remove Duplicate CSS Preloads from theme.liquid
**Expected gain:** 1–2 fewer HTTP requests, cleaner `<head>`  
**File:** `layout/theme.liquid` lines 32–45  
**Risk:** None — the actual CSS loads are in `head-assets.liquid`

Remove lines 32–45 (the 5 `rel="preload"` CSS entries) since the same files are already loaded by `head-assets.liquid`. The preload pattern here is incomplete (no `onload` swap happens correctly for all browsers).

---

### QW3 — Move Sections Inside `</html>`
**Expected gain:** Valid HTML, eliminates parser confusion, fixes rendering bugs  
**File:** `layout/theme.liquid` lines 368–375  
**Risk:** Low — test after moving to confirm sections appear correctly

Move `{% section 'recent-orders2' %}` and `{% section 'new-arrivils' %}` to inside `<body>` before `</body>`.

---

### QW4 — Fix Empty Swiper CSS
**Expected gain:** Eliminates Swiper-caused CLS  
**File:** `assets/swiper-bundle.min.css`  
**Risk:** None

Download the correct `swiper-bundle.min.css` matching the version of `swiper-bundle.min.js` in the theme. Replace the empty file.

---

### QW5 — Move `product.js` to Product-Only Loading
**Expected gain:** 82KB less JS on all non-product pages  
**File:** `snippets/scripts-tag.liquid` line 16  
**Risk:** Low — test all non-product pages

Move `<script src="{{ 'product.js' }}">` from the global section into `{%- when 'product' -%}` case.

---

### QW6 — Conditionally Load `judgeme-reviews.css`
**Expected gain:** Removes unnecessary CSS from cart, blog, 404, account pages  
**File:** `snippets/head-assets.liquid` line 325  
**Risk:** None

```liquid
{%- if template.name == 'product' or template.name == 'collection' or template.name == 'index' -%}
  {{ 'judgeme-reviews.css' | asset_url | stylesheet_tag }}
{%- endif -%}
```

---

### QW7 — Remove Duplicate `cdn.shopify.com` Preconnect
**Expected gain:** Cleaner `<head>`, minor  
**File:** `layout/theme.liquid` line 105  
**Risk:** None — duplicate preconnects are ignored by browsers

---

### QW8 — Fix `blueskytechco` Preload to Use woff2
**Expected gain:** Browser downloads the optimal format without a format fallback  
**File:** `layout/theme.liquid` line 46  
**Risk:** None

Change `.ttf` to `.woff2` in the preload link.

---

### QW9 — Wrap LCP Preload in Homepage Condition
**Expected gain:** Prevents irrelevant image preload on collection/product/blog pages  
**File:** `layout/theme.liquid` lines 197–204  
**Risk:** None

```liquid
{%- if template.name == 'index' -%}
  <link rel="preload" as="image" href="..." ...>
{%- endif -%}
```

---

### QW10 — Reduce Google Font Weight Variants
**Expected gain:** ~50–70% reduction in Google Fonts payload  
**File:** `snippets/head-assets.liquid` lines 37–39, 79–81, 121–123  
**Risk:** Low — test for visual regressions

Change from all 12 variants to only the weights actually used:

```liquid
{# Before #}
{{ fnt_body_gg }}:300,300i,400,400i,500,500i,600,600i,700,700i,800,800i

{# After (example — use only what the theme needs) #}
{{ fnt_body_gg }}:400,500,700
```

---

## Medium Effort Improvements (30 min – 2 hours each)

### ME1 — Consolidate Variant Loops in `product-item.liquid`
**Expected gain:** 30–60% reduction in Liquid render time on collection pages  
**File:** `snippets/product-item.liquid`  
**Risk:** Medium — requires careful testing of all product card states (sale, sold out, pre-order, in-stock)

All 6 `for variant in product.variants` loops should be merged into a single loop that sets all needed variables in one pass. See CODE_FIXES.md for the pattern.

---

### ME2 — Replace `content_for_header` URL Parsing with `request` Object
**Expected gain:** Reduced Liquid render time on collection and search pages  
**Files:** `sections/main-collection-product.liquid`, `sections/main-blog.liquid`, `sections/main-blog-portfolio.liquid`, `sections/product-sidebar.liquid`  
**Risk:** Low — test URL parameter parsing still works

Replace:
```liquid
{%- capture contentForQuerystring -%}{{ content_for_header }}{%- endcapture -%}
{%- assign pageUrl = contentForQuerystring | split: '"pageurl":"' ...
```

With:
```liquid
{%- assign pageQuerystring = request.query_string -%}
```

---

### ME3 — Minify `base.css`
**Expected gain:** ~35–50KB savings (20–30% of 165KB)  
**File:** `assets/base.css`  
**Risk:** Low — minification is lossless

Use any CSS minifier (e.g., `csso`, `clean-css`, online tool) to produce a minified version. Upload as `base.css` to replace the current unminified file.

---

### ME4 — Move `scrolling-text.css` Out of `product-item.liquid`
**Expected gain:** Removes body-injected `<link>` tags from product grid  
**File:** `snippets/product-item.liquid` line 1, `snippets/head-assets.liquid`  
**Risk:** Low

Move `{{ 'scrolling-text.css' | asset_url | stylesheet_tag }}` from `product-item.liquid` to `head-assets.liquid` (loaded once globally).

---

### ME5 — Reduce `product-recommendations` Fetch Distance
**Expected gain:** Fewer wasted network requests on product page load  
**File:** `sections/product-recommendations.liquid` lines 103–105  
**Risk:** None

Change `rootMargin: '0px 0px 1200px 0px'` to `'0px 0px 300px 0px'`.

---

### ME6 — Add `fetchpriority="high"` to First Product Image on Collection/Homepage
**Expected gain:** Improved LCP on collection and homepage  
**File:** `snippets/responsive-image.liquid`, `snippets/product-item.liquid`  
**Risk:** Low

Pass a `priority` flag to `responsive-image.liquid` from the first product in the loop and use it to set `fetchpriority="high" loading="eager"`.

---

## High-Impact Improvements (2–8 hours each)

### HI1 — Split and Lazy-Load JavaScript Bundles
**Expected gain:** 200–400ms faster Time to Interactive  
**Files:** All JS assets  
**Risk:** High — requires thorough testing

- Remove PhotoSwipe JS from global load; load it only when gallery zoom is triggered
- Load `easydlg.min.js` only when a dialog is about to open
- Consider code-splitting `theme.js` to separate cart, search, and navigation logic

---

### HI2 — Implement Critical CSS Strategy
**Expected gain:** 300–600ms LCP improvement  
**File:** `assets/critical.css`, `snippets/head-assets.liquid`  
**Risk:** Medium

The current `critical.css` is only 7KB — very small. Expand it to include above-the-fold CSS for the header, hero, and first product row. Then defer `base.css` loading using the preload + onload async pattern:

```html
<link rel="preload" href="{{ 'base.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'base.css' | asset_url }}"></noscript>
```

---

### HI3 — Convert Liquid Page Templates to JSON Templates
**Expected gain:** Improved TTFB on landing pages  
**Files:** All `templates/page.*.liquid` files  
**Risk:** Medium — functionality testing required

Convert the 40+ `.liquid` page templates to `.json` templates that reference sections. This reduces server-side Liquid evaluation cost.

---

### HI4 — Remove Unused CSS
**Expected gain:** 20–40KB across `base.css`, `vendor.css`  
**Tool:** PurgeCSS or Shopify theme DevTools Coverage tab  
**Risk:** Medium — requires audit of what CSS selectors are actually used

Run a CSS coverage analysis on each page type and remove unused rules from `base.css` and `vendor.css`.

---

## Long-Term Improvements

### LT1 — Implement a Build Pipeline
Use a build tool (Vite, Parcel, or esbuild) to:
- Bundle and tree-shake JavaScript
- Auto-minify CSS
- Generate optimised font subsets
- Automate critical CSS extraction

### LT2 — Self-Host Google Fonts
Download the font files served by Google Fonts and host them in the Shopify assets folder. This:
- Eliminates the `fonts.googleapis.com` and `fonts.gstatic.com` DNS lookups
- Removes a third-party dependency
- Allows preloading the exact `.woff2` files needed

### LT3 — Audit and Remove Unused Sections/Snippets
Review sections like `new-arrivils.liquid`, `pendtent-con.liquid`, `mood-switch.liquid`, and unused snippet files. Remove any that are not referenced in any template or section schema.

### LT4 — Shopify App Performance Audit
Audit all installed Shopify apps for script injection. Each app that injects scripts via `content_for_header` adds to the JS parse burden. Use the Shopify Theme Inspector Chrome extension to see all app-injected scripts.
