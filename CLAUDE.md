# AIOS Working Rules

## Working Directory
C:\Users\PC\OneDrive\Desktop\kuberan web

## For every completed task:

- Save evidence in /evidence
- Save validation reports in /validation
- Save reusable documentation in /docs
- Save closure notes in /closure
- Save reusable prompts in /prompts

## Rules

- Search existing assets before creating new ones.
- Never create duplicate documentation.
- Do not push to GitHub without permission.
- Always include purpose, evidence, status, reviewer, next step, and PASS/FAIL in reports.

## Shopify Themes

All themes live under `shopify-themes/`. Each has its own `.git` and GitHub remote.

| Store | Local Path | CLI Dev Command | CLI Push Command |
|-------|-----------|-----------------|------------------|
| ledsone-de | shopify-themes/ledsone-de | `shopify theme dev --store ledsone-de.myshopify.com` | `shopify theme push --live --store ledsone-de.myshopify.com` |
| ledsone-us | shopify-themes/ledsone-us | `shopify theme dev --store ledsone-us.myshopify.com` | `shopify theme push --live --store ledsone-us.myshopify.com` |
| vintagelite | shopify-themes/vintagelite | `shopify theme dev --store vintagelite.myshopify.com` | `shopify theme push --live --store vintagelite.myshopify.com` |
| dcvoltage | shopify-themes/dcvoltage | `shopify theme dev --store dcvoltage.myshopify.com` | `shopify theme push --live --store dcvoltage.myshopify.com` |
