# Ledsone — Shopify→Google Sheets UTM / Product Report Extension

| | |
|---|---|
| **Project** | Kuberan Workstream — Analytics / Attribution |
| **Store** | ledsone.myshopify.com (Apps Script, GraphQL Admin API) |
| **Category** | Reporting automation (Google Apps Script) |
| **Date** | 17/06/2026 |
| **Status** | Code delivered; date-filter bug under diagnosis |

## Objective
Extend the existing Shopify→Google Sheets Apps Script with a **Product × UTM attribution report** for **May + June 2026**, filtered to a supplied Product ID list, without rewriting or breaking existing functions.

## Work done
- **Analyzed** the existing script: identified reusable functions (`fetchAllOrdersWithProducts`, `visitUtm`, `deriveChannel`, `getChannelColor`), what to modify, what to leave untouched.
- **Analyzed** the pasted Product ID list (~95 IDs, numeric 10–14 digits; ≥2 duplicates: `4417265696864`, `7738421936378`; no blanks/invalid). Designed loader to read IDs **dynamically from a `Product IDs` sheet tab** (no hardcoding) and dedupe via Set.
- **Designed minimal change:** one additive GraphQL field — `product { id title productType }` — so line items can be filtered by product ID. Matcher checks **both** product.id and variant.id (ID-type ambiguity).
- **Delivered production-ready module** (`runMayJunProductUtmReport` + loader + 4 sheet writers + reconciliation validation), reusing existing attribution logic (first-session only). 4 output tabs: `May-Jun Product UTM`, `Product Summary`, `UTM Summary`, `Channel Summary`.
- Defined Revenue = original×qty (gross), Net Sales = discounted×qty (net) — documented, with a toggle to match the old "both discounted" behaviour.

## Honest caveats flagged to user
- **May attribution mostly "Unknown":** Shopify retains `customerJourneySummary` ~30 days; May orders are >30 days old → first-session UTM/channel blank (revenue/units still correct).
- **6-min Apps Script limit:** journey-heavy query won't process 50k orders in one run; recommended month-by-month + optional checkpoint/resume.

## Open issue (in progress)
GraphQL error: **`Invalid timestamp for query filter created_at`** → 0 orders fetched.
- First fix attempted: full RFC 3339 quoted timestamps (`'2026-05-01T00:00:00Z'`) + exclusive `<` bound. **Did not resolve.**
- Provided a **diagnostic function** (`testDateFilter`) that tests 4 date formats to isolate format vs value vs scope.
- **Leading hypothesis:** the store's real current date is earlier than 2026, so the hardcoded 2026 dates are future → no/invalid match. Awaiting diagnostic output to confirm and finalise the date fix.

## Next action
Run `testDateFilter()`, read which format returns orders, then lock the correct `created_at` format / month range and re-run `runMayJunProductUtmReport()`.
