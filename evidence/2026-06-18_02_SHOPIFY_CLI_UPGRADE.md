# 02 — Shopify CLI Verify / Upgrade

**Date:** 18/06/2026 · **Status:** Done

## Objective
Confirm tooling and get the `shopify store` commands (Admin GraphQL from terminal).

## What happened
- Verified installed: Node v24.11.1, npm 11.6.2, Git 2.53, Shopify CLI **3.91.1**.
- `shopify store` commands (store auth/execute/info) require CLI **4.x** → upgraded: `npm install -g @shopify/cli@latest`.

## Outcome
CLI 4.x with `shopify store auth`, `shopify store execute`, `shopify store info` available.
