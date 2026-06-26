# Performance Testing Checklist

**Store:** ledsone.de | **Date:** 2026-06-09

Use this checklist before applying changes to live and after applying changes to a dev/duplicate theme.

---

## Pre-Testing Setup

- [ ] Duplicate the live theme in Shopify Admin → Themes → Actions → Duplicate
- [ ] Name the duplicate: `[Theme Name] - Perf Testing YYYY-MM-DD`
- [ ] Apply all changes to the **duplicate theme only**
- [ ] Preview the duplicate using the Shopify theme preview URL
- [ ] Never apply untested changes directly to the live/published theme

---

## Shopify Theme Preview Testing

### Homepage
- [ ] Homepage loads and all sections display correctly
- [ ] Hero slider / banner displays without layout shift
- [ ] Navigation menu works on desktop and mobile
- [ ] All fonts render correctly (check headings, body, menu)
- [ ] Product carousels initialise correctly (Swiper loads)
- [ ] No JavaScript errors in browser console (F12 → Console)
- [ ] Quick view / add-to-cart works from homepage product grids
- [ ] Announcement bar displays

### Collection Page
- [ ] All products display in correct grid layout
- [ ] Product images load with correct dimensions (no layout shift)
- [ ] Filter / sidebar works correctly
- [ ] Sort dropdown works
- [ ] Pagination / Load More / Infinite Scroll works
- [ ] Product card hover effects work
- [ ] Quick view opens and closes correctly
- [ ] Add to cart from collection grid works
- [ ] Swatches display correctly
- [ ] Sale / Sold Out / Pre-Order labels display correctly

### Product Page
- [ ] Product images display in the gallery
- [ ] Image zoom (if enabled) works
- [ ] Variant selection updates price and availability
- [ ] Add to cart works
- [ ] Product recommendations section loads (check via scroll)
- [ ] Bought together / bundled products display (if enabled)
- [ ] Reviews display (Judge.me or Loox widgets)
- [ ] Sticky add-to-cart bar works on scroll
- [ ] Tabs (description, specs, etc.) open and close
- [ ] Breadcrumbs display correctly

### Search Page
- [ ] Search returns results
- [ ] Predictive search / autocomplete works in header
- [ ] Filters work on search results page
- [ ] Products display correctly

### Cart
- [ ] Cart page loads
- [ ] Mini-cart / drawer opens from header icon
- [ ] Quantity can be updated
- [ ] Line items can be removed
- [ ] Cart upsell suggestions display (if enabled)
- [ ] Checkout button works

### Blog
- [ ] Blog listing page displays posts
- [ ] Individual blog post loads
- [ ] Blog sidebar works (if enabled)

### Account Pages
- [ ] Login page loads
- [ ] Register page loads
- [ ] Account dashboard loads for logged-in user
- [ ] Order history displays

### Other Pages
- [ ] 404 page displays
- [ ] Contact form submits
- [ ] FAQ page loads and accordions work

---

## Lighthouse Testing

Run Lighthouse on each of the following pages **in an Incognito window** using Chrome DevTools (F12 → Lighthouse tab).

### Settings
- Device: **Mobile** (primary) and Desktop (secondary)
- Mode: Navigation
- Categories: Performance, Accessibility, Best Practices, SEO

### Pages to Test

| Page | URL to Test |
|------|------------|
| Homepage | `https://[your-preview-url]/` |
| Collection | `https://[your-preview-url]/collections/[your-main-collection]` |
| Product | `https://[your-preview-url]/products/[your-bestseller]` |
| Blog Post | `https://[your-preview-url]/blogs/[blog]/[post]` |
| Search | `https://[your-preview-url]/search?q=test` |

### Record Scores Before and After

| Page | Before Score (Mobile) | After Score (Mobile) | Delta |
|------|----------------------|---------------------|-------|
| Homepage | | | |
| Collection | | | |
| Product | | | |
| Search | | | |

---

## Core Web Vitals Validation

Use [Google PageSpeed Insights](https://pagespeed.web.dev/) with the theme preview URL.

### Metrics to Track

| Metric | Target (Good) | Before | After |
|--------|--------------|--------|-------|
| LCP | < 2.5s | | |
| CLS | < 0.1 | | |
| INP | < 200ms | | |
| FCP | < 1.8s | | |
| TTFB | < 800ms | | |
| Speed Index | < 3.4s | | |

---

## Mobile Performance Validation

Test on a real device or use Chrome DevTools device emulation:
- Throttling: Slow 4G
- CPU throttling: 4x slowdown

- [ ] Navigation is usable within 3 seconds on slow 4G
- [ ] Images load progressively (lazy loading works)
- [ ] No horizontal scroll on mobile
- [ ] Touch targets are large enough (buttons, links)
- [ ] Mobile sticky bar (add to cart) appears and functions
- [ ] Mobile menu opens and closes
- [ ] Filter drawer opens on mobile collection pages

---

## Specific Fix Validation

After applying each fix from CODE_FIXES.md, validate:

### Fix 1 — Clarity script async
- [ ] Open Network tab in DevTools — Clarity should not block page rendering
- [ ] Clarity still records sessions (check Clarity dashboard after ~10 minutes)

### Fix 2 — Sections inside `</html>`
- [ ] `recent-orders2` section displays in correct position on product pages
- [ ] `new-arrivils` section displays correctly on pages where it appears
- [ ] No duplicate rendering of either section

### Fix 3 — Remove duplicate CSS preloads
- [ ] CSS still loads on all pages (no broken styles)
- [ ] Check Network tab: each CSS file appears only once

### Fix 4 — Swiper CSS
- [ ] All carousels display correctly without layout shift
- [ ] Swiper slides show correct width on load (not collapsed then expanded)

### Fix 5 — `product.js` moved to product-only
- [ ] Product variant selection still works
- [ ] Product gallery still works
- [ ] Collection page loads without JavaScript errors
- [ ] Cart page loads without JavaScript errors
- [ ] Homepage loads without JavaScript errors

### Fix 6 — Judge.me CSS conditional
- [ ] Reviews still display on product pages
- [ ] Reviews still display on collection pages (if applicable)
- [ ] Cart page has no broken styles where reviews were removed

### Fix 9 — `content_for_header` replacement
- [ ] Collection sidebar filter still works
- [ ] Pagination mode (load more / infinite scroll) still toggles correctly
- [ ] Grid column switcher still works
- [ ] Sort order still works

---

## Rollback Plan

If any fix causes a regression:

1. Go to Shopify Admin → Themes
2. The original live theme is still published and untouched
3. Discard changes to the duplicate theme
4. Re-apply fixes one at a time to identify which one caused the issue
5. Never delete the original theme backup

---

## Sign-off

Before publishing the optimised theme:

- [ ] All pages in the testing checklist pass
- [ ] Lighthouse performance score improved vs baseline
- [ ] No JavaScript console errors on any major page
- [ ] No visual regressions on mobile or desktop
- [ ] CLS is 0.1 or below on all tested pages
- [ ] Reviewed by a second person (recommended)
