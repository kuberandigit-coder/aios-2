# Evidence — Garten Collection Pro Snippet

**Date:** 2026-06-26
**Store:** ledsone-de.myshopify.com
**Status:** PASS — Pushed Live

---

## Purpose

Create a collection-specific promotional promo bar snippet for the Gartenbeleuchtung collection, identical in structure to the existing pro snippet pattern, with updated offer text and coupon code.

---

## Files Created / Modified

| File | Action | Detail |
|------|--------|--------|
| `shopify-themes/ledsone-de/snippets/garten-pro.liquid` | Created | New snippet — copy of pendelleuchten-pro.liquid |
| `shopify-themes/ledsone-de/sections/main-product.liquid` | Modified | Added render block for gartenbeleuchtung collection |

---

## Source Snippet

`snippets/pendelleuchten-pro.liquid`

---

## Exact Changes Made

| # | Element | Old Value | New Value |
|---|---------|-----------|-----------|
| 1 | Offer text | `10 % Rabatt bei 3 oder mehr Pendelleuchte` | `10 % Rabatt Gesamte Bestellung` |
| 2 | onclick code | `'PEN10'` | `'LEDU10'` |
| 3 | Code display span | `PEN10` | `LEDU10` |

No CSS, JS, HTML structure, classes, or animation changed.

---

## Render Logic Added (main-product.liquid)

```liquid
{% assign target_collection = 'gartenbeleuchtung-fur-den-aussenbereich' %}

{% for collection in product.collections %}
  {% if collection.handle == target_collection %}
    {% render 'garten-pro' %}
    {% break %}
  {% endif %}
{% endfor %}
```

---

## What the Promo Bar Shows

- Text: **10 % Rabatt Gesamte Bestellung**
- Code: **LEDU10** (click to copy)
- Design: Animated gradient bar (blue/silver), same as all other pro snippets
- Mobile: Responsive — stacks vertically under 768px

---

## Trigger Condition

Promo bar appears automatically on any product page where the product belongs to collection handle: `gartenbeleuchtung-fur-den-aussenbereich`

---

## Deployment

- Preview tested via: `shopify theme dev --store ledsone-de.myshopify.com`
- Preview theme ID: `185266897161`
- Pushed live: `shopify theme push --live --store ledsone-de.myshopify.com`
- Confirmed by user: Yes

---

## Reviewer

Kuberan

## Next Step

None — task complete. Monitor live product pages in gartenbeleuchtung collection to confirm promo bar renders correctly.
