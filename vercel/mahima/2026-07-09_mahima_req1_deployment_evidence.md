# Deployment Evidence — Mahima Requirement 1: Live Deployment (99.9% Blended Pricing)

**Title:** Deployed Mahima Req1 to production with the 99.9% Shopify+Postgres blended pricing approach
**Purpose:** Kuberan/Mahima decided to keep the blended pricing (99.9% coverage) rather than switch to Postgres-only (~18.7%)
**Requirement Source:** User instruction, 2026-07-09 ("keep 99.9% blended pricing, deploy it")
**Team Member:** Mahima · **Reviewer:** Kuberan

## Pre-deploy validation
- Div balance: 38 open / 38 close
- `node --check` syntax: passed, exit 0
- Row count: 6,781 (all 5 campaigns, Jan 1–Jun 30 2026)
- Product Price coverage: 6,773 of 6,781 (99.9%)

## Deployment
- `vercel deploy --prod` from `reports/digital-marketing-member-pages/`
- Live URL: `https://digital-marketing-member-pages.vercel.app/pages/mahima.html`

## Post-deploy verification (live fetch)
- HTTP 200
- 6,781 rows confirmed in the live embedded dataset
- 6,773 rows with price confirmed (99.9% match to local build)
- Product Cost / Gross Profit / Profit After Ads columns confirmed removed

## Summary of what's live
- All 5 of Mahima's campaigns, unified to Jan 1 – Jun 30 2026
- Start/End date-range picker
- Real Product Price for 6,773 of 6,781 rows, sourced via a mix of direct Shopify API lookups and Postgres Merchant Center cross-checks (documented across `evidence/mahima/2026-07-08_mahima_req1_shopify_prices_batch1/2/3_evidence.md` and the price-verification fix)
- Feed Status, Missing Attribute, Last 7/30 Days ROAS, Suggested Action: Data Missing (confirmed no source exists anywhere, not invented)
- 8 rows (5 distinct products) with Data Missing price: confirmed genuinely deleted from Shopify with no reliable Postgres evidence either

**Duplicate risk:** GREEN
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** LIVE
**Known Limitations:** as documented in prior evidence files (99.9% not 100% price coverage; Feed Status/Missing Attribute require a live Merchant Center API connection to ever populate)
**Next Steps:** sync to Staff-requirements
**PASS / FAIL:** PASS
