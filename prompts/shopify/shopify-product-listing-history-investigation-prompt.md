# Reusable Prompt: Shopify Product/Listing History Investigation (Read-Only)

Use this when a team member reports a product/listing is missing and asks whether it was deleted, archived, unpublished, or changed — and who did it.

## Prerequisites

- Shopify MCP (`claude.ai Shopify`) connected to the correct store (confirm with `get-shop-info` first)
- Read-only investigation — never edit/restore/delete/publish anything during the investigation

## Method (in order)

1. **Confirm store context** — call `get-shop-info`, verify domain matches the store the user named.
2. **Try to fetch the product directly:**
   - `get-product` with `id: gid://shopify/Product/<ID>`
   - `graphql_query`: `query($id: ID!) { product(id: $id) { id title handle status vendor createdAt updatedAt publishedAt } }`
   - `search_products` with `search_query: "id:<ID>"`
   - If any of these return the product, note its `status` (ACTIVE/DRAFT/ARCHIVED) — this covers unpublish/archive/draft cases, no deletion occurred.
3. **If not found by any method above, check the shop's Events API for a destroy event:**
   ```graphql
   query {
     events(first: 50, query: "subject_type:PRODUCT AND action:destroy", reverse: true) {
       edges {
         node {
           id
           createdAt
           action
           message
           ... on BasicEvent {
             author
             attributeToUser
             attributeToApp
             appTitle
             subjectId
           }
         }
       }
     }
   }
   ```
   - Match `subjectId` against `gid://shopify/Product/<ID>`.
   - `author` = display name of actor; `attributeToUser: true` = human admin action; `appTitle` = surface used (e.g. "Shopify Web" = admin UI, or a specific app name if API/automation-triggered).
   - Note: `events` query does NOT support a `subject_id:` filter — you must filter by `subject_type` + `action` and manually match `subjectId` across returned records. Paginate with `after` if the deletion is older than the first page.
   - Events are retained for up to ~1 year (per Shopify's documented Events API retention). If the deletion may be older, say so as a limitation.
4. **If found, this confirms a hard delete** (not archive/unpublish — those keep the product retrievable via the API with a status field).
5. **Document limitations clearly:**
   - Deleted products' pre-deletion attributes (title, price, images, variants) are NOT retrievable via Admin API — only the bare event record survives.
   - `author` is a display name, not a verified email — cross-reference Shopify Admin → Settings → Users and permissions for full identity confirmation if needed.
   - Historical product state may be recoverable from indirect sources: past order line items (which snapshot title/price), theme/collection page caches, external feed exports (Google Merchant Center), or internal spreadsheets.

## Output format

Save evidence to `evidence/shopify/listing-history/<store>-listing-<product-id>-investigation.md` using this table format:

| Check | Evidence | Result | Gap | Next Step |
|---|---|---|---|---|

Include: exact method used, raw response summary, product status result, actor (only if proven), and explicit limitations section.

## Pass/Fail

- PASS: status + all available history saved with evidence (including actor if the API exposed it).
- FAIL: any part of the answer is guessed, chat-only, or not saved to a file.
