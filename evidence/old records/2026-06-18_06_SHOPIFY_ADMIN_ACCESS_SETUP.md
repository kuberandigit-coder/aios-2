# 06 — Shopify Admin (Data) Access Setup

**Date:** 18/06/2026 · **Store:** vintage-light-web.myshopify.com · **Status:** Done

## Objective
Let Claude Code read/write store data (products, orders, customers, metafields) via Admin GraphQL.

## Commands
```
shopify store auth --store vintage-light-web.myshopify.com --scopes "read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,read_metaobjects,write_metaobjects"
```
→ authenticated as vintageliteuk@gmail.com against the store.

Run GraphQL:
```
shopify store execute --store vintage-light-web.myshopify.com --query 'query { shop { name id } }'
```
(needs `--query` or `--query-file`; for long queries use a `.graphql` file.)

## Permission model
- Claude runs `shopify store execute` via approved terminal commands.
- Reads = safe (can "Allow always"); writes/mutations shown first, run only on confirm.

## Open note
For **customer** metafields/writes, re-auth adding `write_customers` (and `write_metafields` if needed).

## Outcome
Admin GraphQL pipe live — separate from the theme (CLI) pipe.
