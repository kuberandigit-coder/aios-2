# Prompt — Mahima Requirement 1: Product Performance Report

**Title:** Create/update Mahima Requirement 1 in mahima.html — Google Ads Product Performance Report
**Purpose:** Assess product-level profitability and feed health to guide Scale/Maintain/Optimize/Pause decisions
**Requirement Source:** GPT planning layer instruction, 2026-07-07, referencing a Google Sheet requirement shown by GPT
**Team Member:** Mahima (Google Ads) · **Supporting AIOS staff:** Kuberan
**Business Question:** Which Google Ads products for ledsone.de should Mahima Scale, Maintain, Optimize, or Pause based on product performance, profitability, feed status, and ROAS?
**PostgreSQL Sources Checked:** Yes — see evidence file for full list
**Status:** STOPPED before HTML build — see evidence/validation for reasons

## Instruction (verbatim summary)
Build a 23-column Google Ads product performance dashboard in `mahima.html` (target path referenced: `C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html`), sourced read-only from PostgreSQL, covering campaign/product/impressions/clicks/CTR/CPC/cost/conversions/conversion value/ROAS/product price/product cost/gross profit/profit after ads/feed status/missing attribute/7d & 30d ROAS/Suggested Action (Scale/Maintain/Optimize/Pause per a documented transparent rule). Do not invent product cost or Google Ads metrics; mark missing data as "Data Missing". Stop if product cost, Google Ads product-level data, or business-logic thresholds are unclear/unavailable.

**Owner:** Mahima · **Reviewer:** Kuberan
**Evidence Location:** `evidence/mahima/2026-07-07_mahima_req1_product_performance_evidence.md`
**Validation:** `validation/mahima/2026-07-07_mahima_req1_product_performance_validation.md`
**PASS / FAIL:** STOPPED (multiple stop conditions triggered — see evidence)
