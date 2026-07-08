# Handover — Mahima Requirement 1: End-of-Day Status (2026-07-08)

**Title:** Where things stand at end of day for Mahima's Product Performance Report
**Purpose:** Give Kuberan/Mahima a single place to see current status and the one open decision
**Requirement Source:** Multiple user instructions throughout 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan

## What's live in the built file right now
- All 5 campaigns, Jan 1–Jun 30 2026, 6,781 product rows
- Start/End date-range picker (matches Kamsi Req2's pattern)
- Product Price: 6,773 of 6,781 rows (99.9%) populated — sourced from a mix of direct Shopify lookups and Postgres ads-feed cross-checks
- Columns: Campaign, Product ID, Impressions, Clicks, CTR, Avg CPC, Cost, Conversions, Conv. Rate, Conv. Value, ROAS, Product Price, Feed Status (Data Missing), Missing Attribute (Data Missing), Last 7/30 Days ROAS (Data Missing), Suggested Action (Data Missing)

## The one open decision
Partway through today, the requirement changed from "get all prices, use whatever source works" to "don't use Shopify at all, Postgres only." I investigated what that would mean:
- **Postgres-only, done properly** (only trusting the unambiguous, DE-market-scoped Merchant Center row): **~18.7% coverage** (~1,268 of 6,781 rows) — the rest have no correctly-scoped DE price anywhere in Postgres.
- **Current blended approach** (Shopify + Postgres cross-checks): **99.9% coverage**.

**The file has not been changed to the Postgres-only standard yet** — it still reflects the 99.9% blended version. This needs a decision before deployment: which standard do you want in the live report?

## Why prices can differ from what you see in Google Ads
Verified with a real example (item 8278561882377): our stored price (from Shopify, live) was €18.99, but the user's live Google Ads screenshot showed €21.27, with the product also showing "Not eligible / Paused." This is very likely a feed-sync lag — Google's Merchant Center cache doesn't update instantly when Shopify's price changes. There's no way to resolve this discrepancy without a live Merchant Center API connection (steps for setting that up were documented for the user separately).

## Also confirmed this session
- Feed Status and Missing Attribute genuinely don't exist anywhere in Postgres, at any real scale (exhaustive 2-pass search) — would need the same live API connection to ever populate.
- Product Cost, Gross Profit, Profit After Ads columns removed (nothing ever populated them).

## Not yet done
- Deployment (explicitly withheld pending the pricing-approach decision above)
- Staff-requirements sync (only happens after deployment, per this task's established norm)

**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built and validated locally — awaiting a pricing-approach decision, then deployment approval
**Next Steps:** Kuberan/Mahima decide: keep 99.9% blended pricing, or switch to ~18.7% Postgres-only
**PASS / FAIL:** PASS (build itself); decision pending
