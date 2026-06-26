# 01 — Install Shopify AI Toolkit Skills into Claude Code

**Date:** 18/06/2026 · **Store/scope:** global (all stores) · **Status:** Done

## Objective
Install the Shopify AI Toolkit so Claude Code can use Shopify skills (shopify-admin, shopify-liquid, etc.).

## What happened
- First attempt `npx skills add Shopify/shopify-ai-toolkit` **failed** on Windows: *"Filename too long"* — the repo (26,979 files) has deeply nested paths exceeding Windows' 260-char limit.
- **Fix:** `git config --global core.longpaths true` (enable git long-path support).
- Re-ran installing a single skill: `npx skills add Shopify/shopify-ai-toolkit --skill shopify-admin`.
- Selected agent: **Claude Code**; scope: **Global** (available in every folder).

## Outcome
Shopify skills available to Claude Code globally (shopify-admin, shopify-liquid, shopify-custom-data, etc.).

## Notes
- For full Windows long-path support (if needed): set registry `LongPathsEnabled=1` (admin) + reboot.
- Prefer installing only needed skills, not the whole 27k-file toolkit.
