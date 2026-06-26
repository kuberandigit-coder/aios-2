# Validation — Garten Pro Snippet

**Date:** 2026-06-26
**Store:** ledsone-de.myshopify.com
**Status:** PASS

---

## Checklist

| Check | Result |
|-------|--------|
| `garten-pro.liquid` did not exist before creation | PASS |
| Source snippet identified (pendelleuchten-pro.liquid) | PASS |
| Only 3 text values changed — no structure/CSS/JS diff | PASS |
| Render block added to main-product.liquid | PASS |
| Collection handle correct (`gartenbeleuchtung-fur-den-aussenbereich`) | PASS |
| Dev server started and preview URL confirmed | PASS |
| Pushed live with `shopify theme push --live` | PASS |
| User confirmed push completed | PASS |
| No existing snippets modified | PASS |
| No templates, assets, config, layout touched | PASS |

---

## Diff Result

Only these 3 lines changed between `pendelleuchten-pro.liquid` and `garten-pro.liquid`:

```
- 10 % Rabatt bei 3 oder mehr Pendelleuchte
+ 10 % Rabatt Gesamte Bestellung

- onclick="copyPromoCode('PEN10', this)"
+ onclick="copyPromoCode('LEDU10', this)"

- <span class="promo-code-value">PEN10</span>
+ <span class="promo-code-value">LEDU10</span>
```

---

## Final Result

**PASS** — Snippet created, wired, and pushed live. No unintended changes.
