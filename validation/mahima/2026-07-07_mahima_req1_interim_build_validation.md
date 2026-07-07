# Validation — Mahima Requirement 1: Interim Build

**Title:** Validation checklist for the interim mahima.html build
**Purpose:** Confirm the build is honest, correct, and clearly labeled
**Requirement Source:** User instruction, 2026-07-07
**Team Member:** Mahima · **Reviewer:** Kuberan
**PostgreSQL Sources Checked:** Yes, read-only

| Check | Result |
|---|---|
| Existing assets searched | PASS (from earlier investigation) |
| PostgreSQL read-only inspection completed | PASS — confirmed no write/mutation calls made |
| mahima.html updated for Requirement 1 only | PASS — no other staff pages touched |
| Real columns match confirmed-available data | PASS — Campaign, Product ID/SKU, Impressions, Clicks, CTR, Avg CPC, Cost, Conversions, Conv. Rate, Conv. Value, ROAS, Suggested Action all sourced from real query results |
| Product Cost / Gross Profit / Profit After Ads not invented | PASS — omitted from table, KPI card explicitly shows "Data Missing" |
| Feed Status / Missing Attribute not invented | PASS — omitted entirely rather than faked |
| KPI cards work | PASS — Total Cost £3,881.89, Total Conversion Value £6,340.37, Overall ROAS 163%, Products to Scale 37, Products to Pause 21 all computed directly from the 680-row dataset |
| Filters work | PASS — Campaign, Suggested Action, ROAS range, search all tested against the embedded dataset |
| Suggested Action rule visible and documented | PASS — badges shown, but explicitly flagged as **not independently verified** (taken as-is from source `mahima_action` column) |
| Data Sources & Calculation Rules section present | PASS |
| Known Limitations section present | PASS — 7 numbered limitations |
| Data freshness disclosed | PASS — "2026-06-11" shown in header chip and limitations, not disguised as live/current |
| AIOS folders updated | PASS |
| Deployment | **NOT performed** — awaiting explicit instruction |

## Data-integrity spot check
```
total rows: 680
total_cost: 3881.89
total_value: 6340.37
overall_roas: 1.6333... (163%)
Scale: 37 | Maintain: 31 | Optimize: 591 | Pause: 21
```
Matches the values rendered in the generated HTML (confirmed via regex extraction).

**Validation result:** PARTIAL PASS — real-data columns are correct and verified; the report is intentionally incomplete relative to the full 23-column spec because 3 data categories (cost, feed status, missing attribute) and 2 sub-metrics (7d/30d ROAS split) have no real source, and this is disclosed rather than invented.
**Owner:** Mahima · **Reviewer:** Kuberan
**Status:** Built — not deployed
**Known Limitations:** see evidence file (7 items)
**Next Steps:** await deploy instruction; separately resolve data gaps
**PASS / FAIL:** PARTIAL PASS (honest interim build, not a full closure of the original 23-column requirement)
