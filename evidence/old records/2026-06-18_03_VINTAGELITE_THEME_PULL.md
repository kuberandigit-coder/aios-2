# 03 — Pull Vintagelite Live Theme via CLI

**Date:** 18/06/2026 · **Store:** vintage-light-web.myshopify.com · **Status:** Done

## Objective
Get the live theme locally so Claude Code can edit it.

## What happened
- `shopify auth login` → authenticated as vintageliteuk@gmail.com.
- First attempt used the vanity domain `vintagelite.co.uk` → CLI appended `.myshopify.com` → `vintagelite.co.uk.myshopify.com` (invalid) → **"not authorized"** error.
- **Fix:** use the **permanent domain** found at admin URL `admin.shopify.com/store/vintage-light-web` → `vintage-light-web.myshopify.com`.
- `shopify theme pull --store vintage-light-web.myshopify.com` → pulled theme **"Dawn Sharmi 1.0"** (#172840386938), 62 sections, 3 layout files.

## Key learning
Always use the permanent `*.myshopify.com` handle with the CLI, never the vanity/custom domain.

## Outcome
Live theme available locally for editing.
