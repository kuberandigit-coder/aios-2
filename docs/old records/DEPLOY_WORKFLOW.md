# 07 — Theme Deploy Workflow (Documented)

**Date:** 18/06/2026 · **Store:** vintage-light-web.myshopify.com · **Status:** Reference

## Deploy options
| Command | New or same theme? | Updates |
|---|---|---|
| `shopify theme push --unpublished` | NEW theme each run | full theme (preview link) |
| `shopify theme push --theme <id>` | SAME named theme | only changed files |
| `shopify theme push --live` | SAME live theme | only changed files |
| `shopify theme dev` | nothing on Shopify | local preview only |

## Safe routine
edit → `theme dev` preview → `theme push --unpublished` → QA preview link → **Publish in Admin**.
Live changes ONLY when you Publish (or run `--live`).

## Direct-to-live (code-only, keep live content)
```
shopify theme push --live --ignore config/settings_data.json --store vintage-light-web.myshopify.com
```
`--ignore config/settings_data.json` prevents overwriting Theme Customizer content set in Admin.

## Scope
Theme push affects **storefront only** — never products/orders/customers (those are Admin API).
