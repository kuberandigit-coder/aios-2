# SUK-R6 — Field Mapping

**Title:** Mailing List Cleanup — Field Mapping
**Requirement ID:** SUK-R6
**Purpose:** Map every requested UI field/card/filter to its data source (or its BLOCKED status), one-to-one.
**Business Question:** Which subscribed customers require email list cleanup based on their subscription status and email engagement?
**Shopify Store:** ledsone.co.uk
**Shopify Objects Checked:** `Customer`, `Customer.emailMarketingConsent`
**Files Modified:** `pages/sukirtha.html` (Requirement 6 tab), `api/requirement.js` (`sukirthaR6HandlerModule`)
**Evidence Location:** `evidence/sukirtha/SUK-R6-shopify-source-map.md`
**Validation Result:** See `validation/sukirtha/SUK-R6-validation-report.md`
**Owner:** Sukirtha
**Coordinator:** Not specified in this session
**Technical Reviewer:** Not specified in this session
**Queryability Reviewer:** Not specified in this session
**Business Validator:** Sukirtha
**Status:** Built
**Known Limitations:** See "Not built" tables below.
**Next Step:** None — mapping is complete for what was built.
**PASS / FAIL:** PASS

## Table columns

| Requested column | Built? | Source |
|---|---|---|
| Email | ✅ | `customer.email` |
| Name | ✅ | `customer.firstName` + `customer.lastName` |
| Subscription Status | ✅ | `customer.emailMarketingConsent.marketingState` |
| Subscribed Date | ✅ | `customer.emailMarketingConsent.consentUpdatedAt` (caveat: consent-change date, see source map) |
| Last Open Date | ❌ BLOCKED | Not available from Shopify Admin API |
| Last Click Date | ❌ BLOCKED | Not available from Shopify Admin API |
| Opens | ❌ BLOCKED | Not available from Shopify Admin API |
| Clicks | ❌ BLOCKED | Not available from Shopify Admin API |
| Total Emails Sent | ❌ BLOCKED | Not available from Shopify Admin API |

## Summary cards

| Requested card | Built? | Reason |
|---|---|---|
| Total Subscribers | ✅ | Count of all deduplicated customer rows |
| Subscribed | ✅ | Count where `marketingState = SUBSCRIBED` |
| Unsubscribed | ✅ | Count where `marketingState = UNSUBSCRIBED` |
| Never Opened | ❌ BLOCKED | Requires Opens data (unavailable) |
| Recently Active | ❌ BLOCKED | Requires Last Open/Click Date (unavailable) |
| Inactive Subscribers | ❌ BLOCKED | Requires engagement recency data (unavailable) |

## Filters

| Requested filter | Built? | Reason |
|---|---|---|
| Search Email | ✅ | Client-side substring filter on `email` |
| Search Name | ✅ | Client-side substring filter on `name` |
| Subscription Status | ✅ | Dropdown: All / Subscribed / Unsubscribed / Pending / Not Subscribed |
| Open Activity | ❌ BLOCKED | Requires Opens data (unavailable) |
| Click Activity | ❌ BLOCKED | Requires Clicks data (unavailable) |

## Table features (all built, none blocked — independent of the engagement-data gap)

| Feature | Built? | Notes |
|---|---|---|
| Responsive | ✅ | Reuses existing `.tablebox`/`.scroll` CSS shared by Requirements 1–5 |
| Pagination | ✅ | 50/100/250/500 rows per page, First/Prev/Next/Last |
| Sorting | ✅ | Click any column header; toggles ascending/descending |
| Search | ✅ | Email + Name text search |
| Sticky header | ✅ | `position:sticky` on `<thead>`, same pattern as Req2's table |
| CSV Export | ✅ | Exports the currently filtered view, all 4 available columns |

## Live refresh

✅ Built. "Refresh Data" button → `/api/requirement?fn=sukirtha-r6&refresh=1` → fresh Shopify
Admin GraphQL customer fetch (bypassing the 60s in-memory cache) → table, cards, and "Last
Refreshed" timestamp all update from the response. No Shopify credential is ever sent to or
readable from the browser — the token stays server-side in `SHOPIFY_UK_ADMIN_TOKEN`.
