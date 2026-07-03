# Code Fixes — Before & After Examples

**Store:** ledsone.de | **Date:** 2026-06-09  
**IMPORTANT:** Test every fix on a duplicate/development theme before applying to live.

---

## FIX 1 — Microsoft Clarity: Add `async`

**File:** `layout/theme.liquid` lines 69–75  
**Risk:** None  
**Effort:** 30 seconds

### Before
```html
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "py88ky947l");
</script>
```

### After
```html
<script async type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "py88ky947l");
</script>
```

**Note:** Adding `async` to the outer `<script>` tag prevents it from blocking parsing. The inner function already sets `t.async=1` for the injected Clarity script — this was already correct; the wrapper script itself was the problem.

---

## FIX 2 — Move Sections Inside `</body>`

**File:** `layout/theme.liquid`  
**Risk:** Low — test display position  
**Effort:** 2 minutes

### Before (lines 368–375, after `</html>`)
```liquid
{% unless product.handle == '...' %}
  {% section 'recent-orders2' %}
{% endunless %}
{% section 'new-arrivils' %}
```

### After (move inside `<body>`, before `</body>` closing tag at approximately line 257)
```liquid
    {%- render 'scripts-tag' -%}
    {% unless product.handle == 'lampenschirme-in-fur-wand-und-pendelleuchten' or product.handle == 'e27-lampenfassung-vintage-stilinnenbereich' %}
      {% section 'recent-orders2' %}
    {% endunless %}
    {% section 'new-arrivils' %}
  </body>
</html>
```

---

## FIX 3 — Remove Duplicate CSS Preloads from theme.liquid

**File:** `layout/theme.liquid`  
**Risk:** None  
**Effort:** 1 minute

### Remove these lines entirely (32–45):
```liquid
{# DELETE THESE — the same files are already loaded in head-assets.liquid #}
<link rel="preload" href="{{ 'reset.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'reset.css' | asset_url }}"></noscript>

<link rel="preload" href="{{ 'bootstrap-grid.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'bootstrap-grid.css' | asset_url }}"></noscript>

<link rel="preload" href="{{ 'utilities.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'utilities.css' | asset_url }}"></noscript>

<link rel="preload" href="{{ 'animations.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'animations.css' | asset_url }}"></noscript>

<link rel="preload" href="{{ 'vendor.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="{{ 'vendor.css' | asset_url }}"></noscript>
```

---

## FIX 4 — Fix `blueskytechco` Font Preload

**File:** `layout/theme.liquid` line 46  
**Risk:** None  
**Effort:** 30 seconds

### Before
```html
<link rel="preload" href="{{ 'blueskytechco.ttf' | asset_url }}" as="font" type="font/ttf" crossorigin>
```

### After
```html
<link rel="preload" href="{{ 'blueskytechco.woff2' | asset_url }}" as="font" type="font/woff2" crossorigin>
```

---

## FIX 5 — Wrap LCP Preload in Homepage Condition

**File:** `layout/theme.liquid` lines 197–204  
**Risk:** None  
**Effort:** 1 minute

### Before
```html
<link rel="preload" as="image"
  href="https://ledsone.de/cdn/shop/files/image_69.webp?v=1772614952&width=1200"
  imagesrcset="..."
  imagesizes="100vw"
  fetchpriority="high">
```

### After
```liquid
{%- if template.name == 'index' -%}
<link rel="preload" as="image"
  href="https://ledsone.de/cdn/shop/files/image_69.webp?v=1772614952&width=1200"
  imagesrcset="
    https://ledsone.de/cdn/shop/files/image_69.webp?v=1772614952&width=600 600w,
    https://ledsone.de/cdn/shop/files/image_69.webp?v=1772614952&width=1200 1200w
  "
  imagesizes="100vw"
  fetchpriority="high">
{%- endif -%}
```

---

## FIX 6 — Move `product.js` to Product-Only Loading

**File:** `snippets/scripts-tag.liquid`  
**Risk:** Low — test all non-product pages  
**Effort:** 2 minutes

### Before
```liquid
<script src="{{ 'shopify.js' | asset_url }}" defer="defer"></script>
<script src="{{ 'theme.js' | asset_url }}" defer="defer"></script>
<script src="{{ 'product.js' | asset_url }}" defer="defer"></script>  {# ← loaded everywhere #}
{%- case t -%}
  {%- when 'product' -%}
    <script src="{{ 'drift.min.js' | asset_url }}" defer="defer"></script>
    <script src="{{ 'main-product.js' | asset_url }}" defer="defer" type="module"></script>
```

### After
```liquid
<script src="{{ 'shopify.js' | asset_url }}" defer="defer"></script>
<script src="{{ 'theme.js' | asset_url }}" defer="defer"></script>
{%- case t -%}
  {%- when 'product' -%}
    <script src="{{ 'product.js' | asset_url }}" defer="defer"></script>
    <script src="{{ 'drift.min.js' | asset_url }}" defer="defer"></script>
    <script src="{{ 'main-product.js' | asset_url }}" defer="defer" type="module"></script>
```

---

## FIX 7 — Conditionally Load `judgeme-reviews.css`

**File:** `snippets/head-assets.liquid` line 325  
**Risk:** None — test product and collection pages for reviews display  
**Effort:** 1 minute

### Before
```liquid
{{ 'judgeme-reviews.css' | asset_url | stylesheet_tag }}
```

### After
```liquid
{%- if template.name == 'product' or template.name == 'collection' or template.name == 'index' -%}
  {{ 'judgeme-reviews.css' | asset_url | stylesheet_tag }}
{%- endif -%}
```

---

## FIX 8 — Reduce Google Font Variants

**File:** `snippets/head-assets.liquid` lines 37–39, 79–81, 121–123  
**Risk:** Low — visually verify all text on key pages  
**Effort:** 5 minutes

### Before
```liquid
{%- capture font_var -%}
  {{ fnt_body_gg | strip | replace: ' ', '+' }}:300,300i,400,400i,500,500i,600,600i,700,700i,800,800i
{%- endcapture -%}
```

### After (adjust weights to what your theme actually uses)
```liquid
{%- capture font_var -%}
  {{ fnt_body_gg | strip | replace: ' ', '+' }}:400,500,600,700
{%- endcapture -%}
```

**Implementation note:** Before applying, use the browser DevTools "Computed" panel to identify which font-weight values are actually applied to elements on the page.

---

## FIX 9 — Replace `content_for_header` URL Parsing

**File:** `sections/main-collection-product.liquid` lines 3–19  
**Risk:** Low — test all URL filters (sidebar, pagination, view mode)  
**Effort:** 10 minutes  
**⚠️ Risky change — test thoroughly**

### Before
```liquid
{% # theme-check-disable ContentForHeaderModification %}
{%- capture contentForQuerystring -%}
  {{ content_for_header }}{%- endcapture -%}
{% # theme-check-enable ContentForHeaderModification %}

{%- assign pageUrl = contentForQuerystring
  | split: '"pageurl":"'
  | last
  | split: '"'
  | first
  | split: request.host
  | last
  | replace: '\/', '/'
  | replace: '%20', ' '
  | replace: '&', '&'
-%}
{%- assign pageQuerystring = pageUrl | split: '?' | last -%}
```

### After
```liquid
{%- assign pageQuerystring = request.query_string -%}
```

**Note:** `request.query_string` returns the raw query string (e.g., `sidebar=left_sidebar&pagination=load_more`). All downstream `pageQuerystring contains '...'` checks will work identically. This eliminates the expensive `content_for_header` capture entirely.

---

## FIX 10 — Reduce recommendations IntersectionObserver margin

**File:** `sections/product-recommendations.liquid` line 103  
**Risk:** None  
**Effort:** 30 seconds

### Before
```javascript
const observer = new IntersectionObserver(this.handleIntersection, {
  rootMargin: '0px 0px 1200px 0px',
});
```

### After
```javascript
const observer = new IntersectionObserver(this.handleIntersection, {
  rootMargin: '0px 0px 300px 0px',
});
```

---

## FIX 11 — Add `fetchpriority` Support to `responsive-image.liquid`

**File:** `snippets/responsive-image.liquid`  
**Risk:** Low  
**Effort:** 10 minutes

### Before (line 61–79)
```liquid
<img
  srcset="..."
  src="{{ image | image_url: width: 533 }}"
  sizes="..."
  alt="{{ image.alt | escape }}"
  class="motion-reduce"
  loading="lazy"
  width="{{ image.width }}"
  height="{{ image.height }}"
  style="--point:{{ image.presentation.focal_point }}"
>
```

### After
```liquid
<img
  srcset="..."
  src="{{ image | image_url: width: 533 }}"
  sizes="..."
  alt="{{ image.alt | escape }}"
  class="motion-reduce"
  {%- if priority == true -%}
    loading="eager"
    fetchpriority="high"
  {%- else -%}
    loading="lazy"
  {%- endif -%}
  width="{{ image.width }}"
  height="{{ image.height }}"
  style="--point:{{ image.presentation.focal_point }}"
>
```

Then in `product-item.liquid` or wherever the first hero image renders:
```liquid
{%- render 'responsive-image', image: product.featured_image, priority: forloop.first -%}
```

---

## FIX 12 — Move `scrolling-text.css` to Global Head

**File:** `snippets/product-item.liquid` line 1 → `snippets/head-assets.liquid`  
**Risk:** None  
**Effort:** 2 minutes

### Step 1: Remove from `product-item.liquid` line 1
```liquid
{# DELETE THIS LINE: #}
{{ 'scrolling-text.css' | asset_url | stylesheet_tag }}
```

### Step 2: Add to `head-assets.liquid` after the other global CSS calls
```liquid
{{ 'scrolling-text.css' | asset_url | stylesheet_tag }}
```

---

## FIX 13 — GTM noscript Tag

**File:** `layout/theme.liquid`  
**Risk:** None  
**Effort:** 2 minutes

Uncomment and move the GTM noscript to immediately after `<body>`:

### After `<body class="...">` opening tag, add:
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NN322MJD"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```
