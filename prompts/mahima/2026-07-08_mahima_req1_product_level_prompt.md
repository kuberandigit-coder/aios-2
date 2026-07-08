# Prompt Copy — Mahima Requirement 1: Product-Level Correction

**Title:** Verbatim task instruction record
**Purpose:** Preserve the exact requirement instruction for audit
**Requirement Source:** GPT planning layer instruction relayed by Kuberan, 2026-07-08
**Team Member:** Mahima
**Business Question:** Which Google Ads products for ledsone.de should Mahima Scale, Maintain, Optimize, or Pause, at genuine product-within-campaign grain?

## Verbatim correction requested
> Mahima wants product-level reporting. Required grain: ONE ROW = ONE PRODUCT INSIDE ONE CAMPAIGN. Do NOT show only campaign-level summary. Do NOT aggregate to campaign only. Each campaign must display all available products under it.

## Required columns (21)
Campaign, Product ID, Product, Impressions, Clicks, CTR, Avg CPC, Cost, Conversions, Conv. Rate, Conv. Value, ROAS, Product Price, Product Cost, Gross Profit, Profit After Ads, Feed Status, Missing Attribute, Last 7 Days ROAS, Last 30 Days ROAS, Suggested Action.

## Explicit constraints
- PostgreSQL read-only only
- Do not invent Product Cost, Feed Status, Missing Attribute, or 7/30-day ROAS split — keep "Data Missing" if no source exists
- Do not use fake product names or sample data
- Do not change Google Ads rules
- Note on target file path: task specified `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`, which does **not exist locally** (confirmed again in this pass) — used the established live path `reports/digital-marketing-member-pages/pages/mahima.html` instead, consistent with every prior Mahima build in this AIOS.

**Status:** Implemented — see evidence/validation files for full detail
**Owner:** Mahima · **Reviewer:** Kuberan
**Next Steps:** Kuberan review; deployment not yet performed (awaiting explicit approval, consistent with prior Mahima session norms)
**PASS / FAIL:** PASS
