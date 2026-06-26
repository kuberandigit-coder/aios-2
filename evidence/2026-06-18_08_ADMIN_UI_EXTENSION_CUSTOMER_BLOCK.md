# 08 — Admin UI Extension: Customer-Page Block (IN PROGRESS)

**Date:** 18/06/2026 · **Project:** Loyalty-app · **Status:** ⏳ Open / blocked

## Objective
Add a custom block to the **customer details page in Shopify Admin** (target `admin.customer-details.block.render`) via an Admin UI extension in the Loyalty app.

## Two paths identified
1. **No-code (metafield):** customer metafield definition (`metafieldDefinitionCreate`, ownerType CUSTOMER) → shows as an editable card on the customer page. Needs `write_customers` scope.
2. **Coded (Admin UI extension):** scaffold with `shopify app generate extension` (Admin block template), write React/Polaris, `shopify app dev` → `shopify app deploy`.

## What happened
- Prepared the scaffold prompt for the in-terminal Claude Code session (Loyalty-app).
- **Blocked:** that Claude Code session returned **`401 Invalid authentication credentials — Please run /login`** (Claude Code's own Anthropic auth expired, not Shopify).

## Next action
1. Run `/login` in the Loyalty-app Claude Code session.
2. Decide block content (VIP tier / loyalty points / order count).
3. `shopify app generate extension` → write code → `shopify app dev` → `shopify app deploy`.
4. Ensure the app is installed on the target store so the block shows.
