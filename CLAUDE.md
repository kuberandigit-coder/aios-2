# AIOS Working Rules

## Working Directory
C:\Users\PC\OneDrive\Desktop\kuberan web

## For every completed task — AUTOMATIC (no user prompt needed):

- Save evidence in /evidence
- Save validation reports in /validation
- Save reusable documentation in /docs
- Save closure notes in /closure
- Save reusable prompts in /prompts

Do NOT wait for the user to say "save AIOS". Save files immediately after every task is done.

## When user says "save AIOS":

1. Save all AIOS files (evidence, validation, closure, docs) as above.
2. Then immediately run:
   ```
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" add .
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" commit -m "docs: AIOS update <date> — <task summary>"
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" push
   ```
3. Confirm push to `github.com/kuberandigit-coder/aios-2` completed.

## Rules

- Search existing assets before creating new ones.
- Never create duplicate documentation.
- Do not push to GitHub without permission — EXCEPT aios-2 which is always pushed automatically after "save AIOS".
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
