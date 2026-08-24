## Purpose
Reconcile Mahima Requirement 5b's ("Product × Campaign Sales" tab on mahima.html) product-scoping mechanism with her curated, authoritative 678-ID list finalized earlier today.

## Business Question
Kuberan: "analysis the mahima req 5" then, once I flagged the discrepancy, "yes reconcile with the 678 list."

## Investigation
Discovered Req5b (`mahimaReq5bHandlerModule` in `api/requirement.js`) was already correctly scoped to the **DE store** (`STORE_DOMAIN = 'ledsone-de.myshopify.com'`) and her 5 DE Google Ads campaigns (confirmed via DB: `account_id=9031058245`, all named `Pmax DE | Mahi...`) — my initial assumption that it was a UK-based feature was wrong and corrected mid-conversation.

However, its product universe was derived **dynamically** every time from `google_ads.product_performance` history for those 5 campaigns (1,313 distinct product IDs), rather than from the curated 678-ID list. Direct SQL comparison found real divergence:
- **475** IDs overlap between the two.
- **203** of the 678 curated IDs were never in the campaign-history derivation (genuinely her products, but never advertised under these 5 specific campaigns, or advertised under an untracked campaign).
- **838** dynamically-derived IDs aren't in the curated list at all (likely over-broad — anything that ever appeared in these campaigns' product-performance rows, not necessarily still hers).

## Fix
Replaced `getMahimaOwnedProductIds()`'s Postgres query with a direct read of the curated list (`data/staff-ids.js`'s `mahima` array — same 678-ID source as `MAHIMA_EXCLUDED_PRODUCT_IDS`). Removed the now-unused DB pool setup and `normalizeProductItemId()` helper that only existed to support the old dynamic derivation.

## Files Modified
- `api/requirement.js`

## Files Regenerated
- `api/data/mahima-req5b-snapshot.json` — live-refreshed with the new scope: 678 owned products (was 3,444 reported by the old derivation's normalized count), 2,781 events (was 6,122).

## Status
PASS — verified live: `mahimaOwnedProductCount: 678`, deployed to production, snapshot regenerated and confirmed via curl.

## Reviewer
Kuberan
