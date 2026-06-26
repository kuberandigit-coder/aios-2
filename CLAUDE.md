# AIOS Working Rules

## Working Directory
C:\Users\PC\OneDrive\Desktop\kuberan web

## Auto-Save Rule — NO USER PROMPT NEEDED

After every response where a task has a clear completed result, automatically:

1. Save evidence in /evidence
2. Save validation in /validation
3. Save closure in /closure
4. Update daily doc in /docs
5. Save reusable prompts in /prompts (if applicable)
6. Run:
   ```
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" add .
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" commit -m "docs: <date> — <task summary>"
   git -C "C:\Users\PC\OneDrive\Desktop\kuberan web" push
   ```

## What counts as a completed task:

- A file was created or modified in the Shopify theme
- A snippet was created and wired
- A section was changed and pushed live
- A bug was fixed
- An analysis or report was delivered
- A git commit or push was made
- A setting or config was changed

## What does NOT trigger auto-save:

- Conversations, questions, explanations only
- Analysis that has no output file
- User is still reviewing or asking follow-up questions
- Task was stopped or cancelled

## If the result turns out wrong:

If user says "change it" or "undo" after I already saved — I update the evidence file to reflect the correction and save again. Never delete previous evidence.

## Rules

- Search existing assets before creating new ones.
- Never create duplicate documentation.
- Do not push Shopify theme to GitHub without permission.
- Always include purpose, evidence, status, reviewer, next step, and PASS/FAIL in reports.
- File naming: YYYY-MM-DD_task-name.md

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
