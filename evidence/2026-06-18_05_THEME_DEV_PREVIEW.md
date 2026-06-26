# 05 — Theme Dev Live Preview Setup

**Date:** 18/06/2026 · **Store:** vintage-light-web.myshopify.com · **Status:** Done

## Objective
Live local preview that hot-reloads as theme files are edited.

## Command
```
cd "C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk"
shopify theme dev --store vintage-light-web.myshopify.com
```

## Outcome
- Preview at `http://127.0.0.1:9292`, hot-reload on every file save. Serving requests (GET 200 /).
- Shareable preview: `https://vintage-light-web.myshopify.com/?preview_theme_id=...`.
- Stop with Ctrl+C — nothing saved to Shopify; live store untouched.

## Daily use
Terminal 1 = `shopify theme dev` (running); Terminal 2 = `claude` (edit files) → watch changes at 127.0.0.1:9292.
