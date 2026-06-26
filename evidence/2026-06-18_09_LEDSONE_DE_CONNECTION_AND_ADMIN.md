# 09 — Ledsone.de — Claude Code Connection + Admin Access Authorized

**Date:** 18/06/2026 · **Store:** ledsone.de → `ledsone-de.myshopify.com` · **Status:** ✅ Done

## Objective
Connect Claude Code to the **main ledsone.de account** for theme work and authorize Admin (data) access so Claude can answer questions from the Shopify store.

## What was done
- Switched from the vintagelite account to the **ledsone.de main account** (`shopify auth logout` → `shopify auth login`).
- Resolved errors hit along the way:
  - `store/ledsone-de.myshopify.com` (wrong — had `store/` prefix from the admin URL) → use **`ledsone-de.myshopify.com`** only.
  - `401 "[API] Service is not valid for authentication"` → fixed by fresh `shopify auth logout` + `login` with the ledsone.de account.
- **Theme terminal set up** for ledsone.de:
  - Theme edit (local files in `C:\Users\PC\OneDrive\Desktop\DE`)
  - Draft/unpublished push: `shopify theme push --unpublished --store ledsone-de.myshopify.com`
  - Live push (changed files only): `shopify theme push --live --store ledsone-de.myshopify.com`
- **Admin access authorized** — Claude can now query the Shopify store (products, orders, customers, etc.) via `shopify store execute`.

## Admin scopes granted to the Claude terminal
```
read_products,write_products,read_orders,write_orders,read_draft_orders,write_draft_orders,
read_customers,write_customers,read_inventory,write_inventory,read_locations,
read_fulfillments,write_fulfillments,read_metaobjects,write_metaobjects,
read_discounts,write_discounts,read_price_rules,write_price_rules,
read_content,write_content,read_themes,write_themes
```

## Outcome
ledsone.de is fully wired to Claude Code — **theme** (CLI: edit / draft push / live push) **and admin data** (Admin GraphQL) both authorized and working.

## Note (preview)
`theme dev` localhost preview can show "Bad Request" for ledsone (markets/cookies). Use Incognito, or preview via `--unpublished` on the real domain.
