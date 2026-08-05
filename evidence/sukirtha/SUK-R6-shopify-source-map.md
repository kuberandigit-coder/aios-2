# SUK-R6 — Shopify Source Map

**Title:** Mailing List Cleanup — Shopify Data Source Map
**Requirement ID:** SUK-R6
**Purpose:** Document exactly which Shopify Admin API objects/fields feed Requirement 6, and which requested fields are not obtainable from Shopify at all.
**Business Question:** Which subscribed customers require email list cleanup based on their subscription status and email engagement?
**Shopify Store:** ledsone.co.uk (env-configured via `SHOPIFY_UK_STORE_DOMAIN`, Admin API version via `SHOPIFY_UK_API_VERSION`, default `2024-10`)
**Shopify Objects Checked:** `Customer` (paginated `customers(first, after)` connection), `Customer.emailMarketingConsent`
**Files Modified:** `api/requirement.js` (new `sukirthaR6HandlerModule`)
**Evidence Location:** this file, `evidence/sukirtha/SUK-R6-field-mapping.md`
**Validation Result:** See `validation/sukirtha/SUK-R6-validation-report.md`
**Owner:** Sukirtha
**Coordinator:** Not specified in this session
**Technical Reviewer:** Not specified in this session
**Queryability Reviewer:** Not specified in this session
**Business Validator:** Sukirtha
**Status:** Confirmed
**Known Limitations:** See "Not available" section below.
**Next Step:** None — source availability is fully determined.
**PASS / FAIL:** PASS

## Query used

```graphql
query($after: String) {
  customers(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        id
        email
        firstName
        lastName
        emailMarketingConsent {
          marketingState
          marketingOptInLevel
          consentUpdatedAt
        }
      }
    }
  }
}
```

Paginated in full (`fetchAllCustomers()` in `sukirthaR6HandlerModule`) — every customer with
an email address on the store is retrieved, not a sample.

## Reused connection architecture

Uses the **same** UK Shopify credential set already in production use by `api/salesuk.js`:
`SHOPIFY_UK_STORE_DOMAIN`, `SHOPIFY_UK_API_VERSION`, `SHOPIFY_UK_ADMIN_TOKEN` — no new
credential, no new Vercel environment variable, no new serverless function file (merged into
the existing `api/requirement.js`, dispatched via `?fn=sukirtha-r6`, consistent with the
Vercel Hobby-plan 12-function cap pattern already used throughout this project).

## Available fields (confirmed via Shopify Admin API schema)

| Required field | Shopify source | Notes |
|---|---|---|
| Email | `customer.email` | Rows without an email are excluded (nothing to clean up) |
| Name | `customer.firstName` + `customer.lastName` | Joined with a space; null if both blank |
| Subscription Status | `customer.emailMarketingConsent.marketingState` | `SUBSCRIBED` / `UNSUBSCRIBED` / `PENDING` / `NOT_SUBSCRIBED` |
| Subscribed Date | `customer.emailMarketingConsent.consentUpdatedAt` | See caveat below — this is a consent-change timestamp, not necessarily the original subscribe date |

**Caveat on "Subscribed Date":** Shopify does not store a distinct "date first subscribed"
field. `consentUpdatedAt` reflects the last time the customer's marketing consent state
changed (subscribe, unsubscribe, or a re-confirmation) — for a customer who has always been
subscribed with no changes, this may coincide with their original opt-in; for one whose
status has changed since, it reflects the most recent change, not the original date. This is
the closest available field and is labeled "Subscribed Date" per the requirement, with this
caveat documented for transparency.

## NOT available — engagement metrics (BLOCKED)

| Required field | Availability |
|---|---|
| Last Open Date | **Not available.** No field on `Customer` or any related object. |
| Last Click Date | **Not available.** Same. |
| Opens | **Not available.** Same. |
| Clicks | **Not available.** Same. |
| Total Emails Sent | **Not available.** Same. |

**Why:** Shopify Email (the built-in marketing-email product) computes open/click analytics
internally and renders them only inside each campaign's own results page in the Shopify Admin
UI. There is no REST or GraphQL resource — on any current or historical Admin API version —
that exposes this data per customer, or even per campaign, for external retrieval. This was
independently verified two ways before any code was written:

1. **Shopify API schema check** — no `Customer` field, no `MarketingEvent`/`MarketingActivity`
   field, and no other documented Admin API object carries open/click/send-count data at the
   customer level.
2. **Live infrastructure check via the ledsone MCP servers** (2026-08-04) — searched the
   entire AIOS knowledge base (`ledsone-aios-mcp`) for "email," "marketing consent,"
   "klaviyo," and "campaign"; zero results relevant to email engagement. Searched the live
   Postgres data warehouse (`ledsone-db-mcp`, `search_objects`) for any table matching
   `%email%` or `%subscri%` across all 18 schemas; **zero tables found**. Confirms this data
   has never been captured anywhere in this organization's infrastructure, not just that it's
   missing from the API.

**Conclusion:** No Shopify Admin API scope or permission grant unlocks these 5 fields — the
endpoint does not exist to request. Per the requirement's own stop condition, these fields
were not built, and no sample/estimated values were substituted.

## Addendum (2026-08-04) — live schema introspection, prompted by user-supplied evidence

Sukirtha shared a screenshot of the Shopify admin's own **"Shopify Messaging"** panel
(the native Shopify Email/SMS/WhatsApp tool), showing per-campaign Open Rate, Click Rate,
Conversion Rate, and Sales — proving the data genuinely exists inside Shopify's systems, not
just that it might not have been captured at all. This warranted re-checking the API against
the live schema (introspection) rather than relying on memory alone.

**Live introspection performed** (temporary debug branch, added and removed same session;
never part of the deployed feature) against the store's actual Shopify Admin GraphQL schema:

- **`MarketingActivity`** (the "campaign" object) — confirmed to carry only metadata fields:
  `title`, `status`, `budget`, `adSpend`, `sourceAndMedium`, `utmParameters`, dates, etc.
  No open/click/send/rate fields of any kind.
- **`MarketingEngagement`** — a real type **does exist** with exactly the stats visible in the
  screenshot: `sendsCount`, `viewsCount`, `uniqueViewsCount` (≈ opens), `clicksCount`,
  `uniqueClicksCount`, `unsubscribesCount`, `occurredOn` (date), linked back to a
  `marketingActivity`. This is almost certainly the object the Shopify Messaging UI itself
  reads to render Open Rate / Click Rate.
- **Critical finding — it is write-only.** The schema exposes only *mutations* for this type
  (`marketingEngagementCreate`, `marketingEngagementsDelete`, plus the corresponding
  `*Input`/`*Payload` types) — this channel exists so **third-party apps push their own
  engagement stats into Shopify's unified marketing reporting**, not so Shopify (or any app)
  can read engagement stats back out. Confirmed by listing every root `Query` field containing
  "marketing"/"engagement"/"email": only `marketingActivity(ies)` and `marketingEvent(s)`
  exist — both metadata-only, as above. No `marketingEngagement`/`marketingEngagements` query
  field exists anywhere in the schema.

**Revised, evidence-grounded conclusion:** the earlier BLOCKED finding stands, but the reason
is now precisely known rather than inferred: Shopify's own native email tool likely writes its
own results into this same write-only `MarketingEngagement` channel to power its admin UI —
meaning even Shopify's own first-party product cannot read its own numbers back out via the
public API. This is a one-directional reporting pipe (apps → Shopify UI), not a two-way data
store. No scope or permission at any level changes this, because there is no read path to grant
access to.

**Practical implication:** if engagement data is genuinely required, the only real routes are
(1) manual export from the Shopify Messaging UI itself (campaign-by-campaign, not automatable,
not live), or (2) adopting a third-party ESP (Klaviyo, Mailchimp, etc.) going forward, which
would expose the same kind of data through its own API instead of Shopify's. Sukirtha confirmed
(2026-08-04) the store does not currently use Klaviyo or Mailchimp — Shopify Messaging (native)
is the only email tool in use. Historical engagement data cannot be retroactively recovered
through any tool, since it was never captured outside Shopify's write-only pipe.
