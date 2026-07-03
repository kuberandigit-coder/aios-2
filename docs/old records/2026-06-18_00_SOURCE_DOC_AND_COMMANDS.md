# 00 — Source Doc + Command Cheat-Sheet (2026-06-18)

## Source document (Kuberan's own notes, with screenshots + code)
**Google Doc — commands tab:** https://docs.google.com/document/d/16Yaxv4V0b_xm0GH1DEUVz-1QQzKdU29CwQ5dHYW8dOo/edit?tab=t.b9z8dog109ft
**Google Doc — step-by-step guide tab:** https://docs.google.com/document/d/16Yaxv4V0b_xm0GH1DEUVz-1QQzKdU29CwQ5dHYW8dOo/edit?tab=t.icc9rqc038hq

This file mirrors the commands from that doc so the cheat-sheet lives in the archive too. The narrative/explanation for each step is in files `01`–`09` in this folder.

---

## Setup & install
```
node -v
claude plugin install shopify-ai-toolkit@claude-plugins-official
claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest
npx skills add Shopify/shopify-ai-toolkit --skill shopify-admin
```
Claude config location (from doc): `C:\Users\PC\.claude.json`  (project: `C:\Users\PC\`)

## Theme folder + pull
```
mkdir -p "/c/Users/PC/OneDrive/Desktop/shopify/vintagelite-couk"
shopify theme pull --store vintage-light-web.myshopify.com
shopify theme dev  --store vintage-light-web.myshopify.com
# preview: http://127.0.0.1:9292/
```
> Note: the `/c/...` mkdir created a stray `C:\c\` folder — see `04_THEME_FOLDER_PATH_FIX.md`. Correct path is `C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk`.

## Daily terminals
**Live preview**
```
cd "C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk"
shopify theme dev --store vintage-light-web.myshopify.com
```
**AI code editor (Claude)**
```
cd "C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk"
claude
```

## Deploy
**Unpublished push (preview theme)**
```
cd "C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk"
shopify theme push --unpublished --store vintage-light-web.myshopify.com
```
**Live push (same live theme, changed files only)**
```
cd "C:\Users\PC\OneDrive\Desktop\shopify\vintagelite-couk"
shopify theme push --live --store vintage-light-web.myshopify.com
```

## Admin (data) — from 06_SHOPIFY_ADMIN_ACCESS_SETUP.md
```
shopify store auth   --store vintage-light-web.myshopify.com --scopes "read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,read_metaobjects,write_metaobjects"
shopify store execute --store vintage-light-web.myshopify.com --query 'query { shop { name id } }'
```
