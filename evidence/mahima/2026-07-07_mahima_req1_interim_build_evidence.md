# Evidence — Mahima Requirement 1: Interim Build (Real-Data-Only Columns)

**Title:** mahima.html built with the 9 confirmed-real columns; Product Cost/Feed Status/Missing Attribute/7d&30d-ROAS explicitly marked Data Missing
**Purpose:** Give Mahima a working, honest interim report now, rather than waiting for full data availability
**Requirement Source:** User instruction, 2026-07-07, following the column-by-column data-possibility review
**Team Member:** Mahima (Google Ads) · **Reviewer:** Kuberan
**Business Question:** Which Google Ads products for ledsone.de should Mahima Scale, Maintain, Optimize, or Pause?
**PostgreSQL Sources Checked:** Yes, read-only — `staging_ai.cppc_workbook_product_performance_v1`, filtered to 5 campaign IDs confirmed as Mahima's via `staging_ai.cppc_campaign_truth_registry_v1` (owner = "Mahi")

## What was built
`mahima.html` (live-site) and `reports/mahima/mahima-requirement-1-product-performance-report.html` (archival copy) now show:
- **680 product rows** across 4 of Mahima's 5 active ledsone.de campaigns (campaign 23926509987 has no product-level rows in the source table)
- Real columns: Campaign, Product (SKU where matched, else raw Google item ID), Impressions, Clicks, CTR, Avg CPC (computed), Cost, Conversions, Conv. Rate, Conv. Value, ROAS, Suggested Action
- KPI cards: Total Cost (£3,881.89), Total Conversion Value (£6,340.37), Overall ROAS (163%), Total Profit After Ads (**Data Missing** — explicitly labeled, not invented), Products to Scale (37), Products to Pause (21)
- Filters: Campaign, Suggested Action, ROAS range (0% / 1–149% / 150–299% / 300%+), search box
- Color-coded Suggested Action badges: Scale=green, Maintain=blue, Optimize=orange, Pause=red
- "Data Sources & Calculation Rules" section and "Known Limitations" section (7 numbered limitations) per the task's requirements
- Data snapshot date (2026-06-11) shown prominently in the header, NOT presented as live "today minus 30 days"

## What was deliberately left out / marked Data Missing
- Product Price, Product Cost, Gross Profit, Profit After Ads — no real source found anywhere (see earlier investigation evidence: `sku_cogs` empty, `cppc_cogs_truth_model_v1` all-NULL cost fields)
- Feed Status, Missing Attribute — `gmc_product_diagnostics_daily` completely empty
- Last 7 Days ROAS / Last 30 Days ROAS as separate figures — source has only one aggregate window per row
- Feed Status/Stock Status filter — no real source, so not built (would be fake if built)
- **Suggested Action rule is not independently verified** — the `mahima_action` values are taken as-is from the source table; I have not reverse-engineered or confirmed the exact logic matches the Scale/Maintain/Optimize/Pause criteria specified in this requirement. Flagged prominently on the page itself.

## Duplicate risk
Unchanged from earlier investigation: GREEN.

## Files created/modified
- `reports/digital-marketing-member-pages/pages/mahima.html` (was placeholder, now built)
- `reports/mahima/mahima-requirement-1-product-performance-report.html` (new archival copy)
- `reports/mahima/data/2026-07-07_mahima_req1_product_performance_raw.json` (raw 680-row query result, saved for auditability)
- `reports/mahima/data/2026-07-07_mahima_req1_html_builder.py` (builder script)

**No PostgreSQL data modified. No other staff pages touched.**

**Evidence path:** this file · previous investigation: `evidence/mahima/2026-07-07_mahima_req1_product_performance_evidence.md`
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built locally — **not deployed** (awaiting explicit deploy instruction)
**Known Limitations:** see 7 numbered limitations on the page itself and above
**Next Steps:** deploy when instructed; separately resolve the 3 blockers (stale data, cost, feed status) per the handover file's 4 options
**PASS / FAIL:** PARTIAL PASS — built honestly with real data only, all gaps labeled "Data Missing" per instruction, but does not meet the full 23-column/all-KPI requirement (by necessity, not oversight)
