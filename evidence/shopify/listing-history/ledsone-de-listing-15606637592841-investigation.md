# LEDSone.de — Listing/Product 15606637592841 Investigation

**Date:** 2026-07-01
**Requested by:** Mahima (Ads team) — reported listing missing, suspected deletion
**Investigator:** Claude (AIOS), read-only investigation
**Purpose:** Determine current status of product 15606637592841 and, if deleted, who deleted it and when
**Status:** COMPLETE — PASS

---

## Store/Admin Context

- Confirmed active MCP connection: **ledsone.de** (domain `ledsone.de`, Basic plan, EUR, Germany)
- Admin URLs returned by API confirm shop slug `ledsone-de` (e.g. `https://admin.shopify.com/store/ledsone-de/...`)
- Product ID format `15606637592841` is a valid Shopify numeric product ID (used as `gid://shopify/Product/15606637592841`)

## Method / Evidence Log

| Check | Method | Raw Result Summary | Result |
|---|---|---|---|
| Product lookup by GID | `get-product` tool, `id: gid://shopify/Product/15606637592841` | `Error: Product not found. Please verify the product ID and try again.` | NOT FOUND |
| Product lookup via GraphQL | `graphql_query`: `product(id: $id) { ... }` | `{"data":{"product":null}}` | NULL — confirms not accessible via Admin API |
| Product search by ID | `search_products`, `search_query: "id:15606637592841"` | `{"data":{"products":{"edges":[],"pageInfo":{"hasNextPage":false}}}}` | 0 results |
| Shop-level Events API — targeted search | `graphql_query` on `events(query: "subject_type:PRODUCT AND action:destroy")` with `... on BasicEvent { author attributeToUser attributeToApp appTitle subjectId }` | Found matching event: `subjectId: "gid://shopify/Product/15606637592841"` | **MATCH FOUND** |

### Matching Event (raw)

```json
{
  "id": "gid://shopify/BasicEvent/257811520323849",
  "createdAt": "2026-06-26T08:34:31Z",
  "action": "destroy",
  "message": "",
  "author": "ledwebde2 LEDSone",
  "attributeToUser": true,
  "attributeToApp": true,
  "appTitle": "Shopify Web",
  "subjectId": "gid://shopify/Product/15606637592841"
}
```

## Findings

| Check | Evidence | Result | Gap | Next Step |
|---|---|---|---|---|
| Product exists (Admin API) | `get-product`, `graphql_query product(id:)`, `search_products id:` | Product NOT FOUND / null / 0 results across all 3 methods | None — consistent across methods | None needed |
| Product status (active/draft/archived) | N/A — product record itself is fully gone, not merely unpublished/archived | Cannot check status because the record no longer exists | Archived/draft/unpublished products still return via API; this one does not — consistent with hard delete, not archive/unpublish | None — deletion confirmed via events, see below |
| Deletion event | `events(query:"subject_type:PRODUCT AND action:destroy")` | `action: destroy`, `subjectId` matches product ID exactly | None | None |
| Timestamp of deletion | Same event, `createdAt` field | **2026-06-26T08:34:31Z** | None | Cross-check against Mahima's report timing if needed |
| Actor / who deleted it | Same event, `author` + `attributeToUser` + `appTitle` fields | `author: "ledwebde2 LEDSone"`, `attributeToUser: true` (confirms an admin staff/user action, not automated), `appTitle: "Shopify Web"` (action taken through the Shopify admin UI, not an app/API integration) | Author field is a display name tied to the staff account, not a raw user ID/email — full identity (email, permission role) requires cross-referencing Settings → Users and permissions in Shopify Admin | If precise staff account/email confirmation is needed, check **Shopify Admin → Settings → Users and permissions** for the account named "ledwebde2 LEDSone" |
| Title/handle/vendor/variants/created_at/etc. at time of deletion | Not retrievable — Admin API does not return field-level snapshots of deleted resources, and the `destroy` event's `message` field was empty for this event | UNAVAILABLE via API | Shopify does not expose a "diff" or last-known-state snapshot of deleted products through any read-only Admin API endpoint (REST or GraphQL) | If the pre-deletion product details (title, price, images) are needed, check: (a) Shopify Admin → Analytics/reports referencing the product by ID/handle, (b) past order line items referencing this product (line items retain a snapshot of title/price even after the product is deleted), (c) any cached theme/collection pages, (d) Google catalog/Merchant Center feed history, (e) internal spreadsheets/CSVs from prior product exports |

## Limitations (Shopify API)

1. **No full audit trail for deleted resources' prior state.** Once a product is destroyed, the Admin API (REST and GraphQL) cannot return its title, vendor, variants, or other attributes — only the shop-level Events API retains a bare event record (action, timestamp, actor, appTitle, subjectId). This is retained for **up to 1 year** per Shopify's documented Events API retention policy.
2. **No `subject_id` filter on the `events` query** — filtering must be done via `subject_type` + `action`, then manually matching `subjectId` in the returned records (API rejects `subject_id:` as an unsupported filter term).
3. **`author` is a display name, not a verified email/user ID.** To fully confirm which staff account this corresponds to (and their permission level), a manual check in **Shopify Admin → Settings → Users and permissions** is recommended as corroborating evidence.
4. **No screenshot/manual admin evidence was captured** — this investigation is entirely API-based. If corroborating visual evidence is required for the record (e.g. for HR/compliance purposes), someone with Admin access should screenshot: Shopify Admin → Settings → Users and permissions (to confirm the "ledwebde2 LEDSone" account and its owner), since Claude does not have interactive Shopify Admin UI/browser access to this store's backend in this session.

## Conclusion

- **Product/listing status:** DELETED (hard delete / "destroy" action) — not archived, not unpublished, not draft.
- **When:** 2026-06-26T08:34:31Z (UTC)
- **Who:** Staff/user account displaying as **"ledwebde2 LEDSone"**, action performed through the Shopify Admin web UI (`appTitle: "Shopify Web"`, `attributeToUser: true` — confirms a human admin action, not an app/API-triggered automatic deletion).
- **Confidence:** High — corroborated by (a) product being fully unretrievable via 3 independent read methods, and (b) an explicit `destroy` event in Shopify's own Events API with matching `subjectId`.

## PASS/FAIL

**PASS** — Product status and deletion history (including actor, timestamp, and method) were retrieved and saved with API evidence. No guessing or unsaved output involved.
