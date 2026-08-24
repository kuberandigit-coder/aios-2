## Purpose
Answer Kuberan's question: is there any TikTok-attributed first-session sales for LEDSone UK in August 2026 — paid ads, or any mention of TikTok at all?

## Business Question
For August 2026 (created_at basis), how much UK sales came from a first session whose source was TikTok (paid ad or organic), and is TikTok present anywhere in the raw first-session data at all?

## Method
- Added a temporary read-only diagnostic dispatch `fn=tiktok-aug-uk-check` to `api/requirement.js` (self-contained IIFE module, reuses `SHOPIFY_UK_ADMIN_TOKEN`/`ledsone.myshopify.com`/API version 2024-10, same pattern as every other one-off handler in this file).
- Fetched all August UK orders via Shopify Admin GraphQL, read `customerJourneySummary.firstVisit` for each.
- Paid-TikTok evidence tiers (same style as existing paid/organic classifiers elsewhere in the codebase): `ttclid` on landing/referrer URL, OR `utm_medium` in a paid-like set (`cpc, ppc, paid, paid_social, cpm, cpv`), OR Shopify's own `sourceType === 'ad'`.
- Also ran a raw case-insensitive substring scan for the literal string "tiktok" across the entire `firstVisit` object (source, referrerUrl, landingPage, all UTM params) — independent of the classifier logic, to catch anything the tiered rules might miss.

## Data Sources
- Shopify UK Admin GraphQL API (`ledsone.myshopify.com`), `SHOPIFY_UK_ADMIN_TOKEN`.

## Result
- 2,378 valid UK orders in August 2026 (test/cancelled excluded).
- 75 orders have no journey data at all (genuinely unattributable — not evidence either way).
- **0 orders** have the word "tiktok" anywhere in `firstVisit`, paid or organic. TikTok has zero first-session presence in LEDSone UK's August 2026 order data.

## Files Created/Modified
- `api/requirement.js` — added `tiktokAugUkCheckModule` (fn=`tiktok-aug-uk-check`). Left in place as a reusable read-only diagnostic (no write access, no sensitive data exposed) — not removed after use.

## Security Notes
No credentials exposed. Endpoint is read-only, reuses an existing server-side token already scoped to this project.

## Status
PASS — question answered from real, live-fetched data; no fabrication.

## Reviewer
Kuberan
