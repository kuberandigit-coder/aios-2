# Handover — Mahima Requirement 1: Product-Level Correction

**Title:** Handover for the product-level clarification + Product Title/Price partial recovery
**Purpose:** Give Kuberan/Mahima everything needed to review and approve deployment
**Requirement Source:** GPT planning layer instruction, 2026-07-08
**Team Member:** Mahima · **Reviewer:** Kuberan

## What's new for Mahima
The report was already genuinely product-level (680 rows, multiple products per campaign) — this update makes that explicit and adds real data that wasn't there before:
- A clear banner: **"Table grain: one row per product within each campaign."**
- **Product ID** and **Product** (real title) are now separate, visible columns
- **Product Price** now shows a real value for **127 of 680 rows (18.7%)** — recovered via a newly-discovered join to Google Merchant Center data, restricted carefully to avoid a data-quality trap (see below)
- New KPI cards: Active Campaigns Covered, Data Freshness Date (alongside the existing Total Cost/Conversion Value/ROAS/Scale/Pause cards)
- Product Title now searchable too

## The interesting technical finding
While looking for a way to add real product names/prices, found that Google Merchant Center data has **up to 15 duplicate rows per product**, each tagged to a different internal marketing "feed_label" (e.g. one for Black Friday, one for a top-sellers push, etc.) — and each of those 15 rows can have a **different price** for the exact same product. One item ranged from £6.49 to £13.37 across its 15 duplicate rows. Picking any of those at random would have meant inventing which price is "the" price. Instead, restricted to the one canonical Germany-market listing per product — which is why coverage is only 18.7% rather than higher, but every price shown is real and unambiguous.

## Still Data Missing (unchanged from the prior build)
Product Cost, Gross Profit, Profit After Ads, Feed Status, Missing Attribute, and the Last 7/30 Days ROAS split — no source exists anywhere in the database for these, confirmed again this pass. Not invented.

## Important — please read
1. **This has not been deployed.** Built and validated locally, consistent with how Mahima's work has been handled previously in this AIOS.
2. The task instruction pointed at `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`, which still doesn't exist on this machine — used the established live path instead (`reports/digital-marketing-member-pages/pages/mahima.html`).
3. If Product Cost data ever becomes available, the 18.7% Product Price coverage would let Gross Profit/Profit After Ads be calculated for at least that subset immediately — worth revisiting together.

**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built and validated locally — awaiting deployment approval
**Next Steps:** Kuberan review; approve deployment when ready
**PASS / FAIL:** PASS
