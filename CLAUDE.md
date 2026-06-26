# AIOS Working Rules

## Working Directory
C:\Users\PC\OneDrive\Desktop\kuberan web

## After EVERY completed task — FULLY AUTOMATIC:

1. Save evidence in /evidence
2. Save validation reports in /validation
3. Save reusable documentation in /docs
4. Save closure notes in /closure
5. Save reusable prompts in /prompts
6. Then immediately run:
   ```
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" add .
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" commit -m "docs: AIOS update <date> — <task summary>"
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" push
   ```

Do NOT wait for the user to say "save AIOS" or "push to aios 2".
Save and push automatically every time a task is completed.

## Rules

- Search existing assets before creating new ones.
- Never create duplicate documentation.
- Do not push Shopify theme to GitHub without permission.
- Always include purpose, evidence, status, reviewer, next step, and PASS/FAIL in reports.

## AIOS Git Repository

| Repo | Remote | Branch |
|------|--------|--------|
| kuberan web (AIOS) | https://github.com/kuberandigit-coder/aios-2 | main |

## Shopify Themes

All themes live under `shopify-themes/`. Each has its own `.git` and GitHub remote.

| Store | Local Path | CLI Dev Command | CLI Push Command |
|-------|-----------|-----------------|------------------|
| ledsone-de | shopify-themes/ledsone-de | `shopify theme dev --store ledsone-de.myshopify.com` | `shopify theme push --live --store ledsone-de.myshopify.com` |
| ledsone-us | shopify-themes/ledsone-us | `shopify theme dev --store ledsone-us.myshopify.com` | `shopify theme push --live --store ledsone-us.myshopify.com` |
| vintagelite | shopify-themes/vintagelite | `shopify theme dev --store vintagelite.myshopify.com` | `shopify theme push --live --store vintagelite.myshopify.com` |
| dcvoltage | shopify-themes/dcvoltage | `shopify theme dev --store dcvoltage.myshopify.com` | `shopify theme push --live --store dcvoltage.myshopify.com` |
