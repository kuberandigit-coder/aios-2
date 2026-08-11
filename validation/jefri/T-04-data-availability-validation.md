# Jefri T-04 — Data Availability Validation

**Purpose:** Validation checklist for the T-04 discovery run, per the discovery prompt's Final Pass/Fail Rule.
**Evidence:** `evidence/jefri/T-04-data-discovery.md`
**Reviewer:** Claude Code (execution worker) · **Date:** 2026-08-11

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Existing AIOS assets searched | ✅ PASS | `prompts/jefri`, `evidence/jefri`, `validation/jefri`, `handover/jefri`, `reports/jefri`, `vercel/jefri`, `jefri.html` all checked; 0 matches for Total Sales/Shopify Sales/order_item_info in `jefri.html` |
| 2 | PostgreSQL sources inspected read-only | ✅ PASS | `ledsone-db-mcp`, SELECT/information_schema only, no writes issued |
| 3 | Every required field has a confirmed source or documented gap | ✅ PASS (with 1 AMBER) | See Data Availability Matrix — Total Sales has a source but ambiguous definition (2 candidates) |
| 4 | Parent → Variant relationship proven | ✅ PASS | Real sample: parent `10020182327561` → 8 real child variants w/ SKUs, via `listings.shopify_listings_parent_child_mapping` |
| 5 | Shopify → Google Ads Item ID relationship proven | ✅ PASS (quantified gap) | 75.3% match rate (3,779/5,021), 24.7% unmatched — root cause identified (non-Shopify-format long IDs, one campaign) |
| 6 | Date filtering proven for both sources | ✅ PASS | Ads: 2025-05-12 to today. Shopify: 2020-10-16 to today. Column types checked, cast confirmed safe |
| 7 | Parent rollup calculation validated | ⚠️ PARTIAL | Formula (SUM, never average) is standard and specified correctly; not independently re-verified with a second live rollup example this session |
| 8 | ROAS calculation validated | ✅ PASS (formula) / ⚠️ NEEDS REVIEW (0-cost handling) | Formula computes correctly on real data (e.g. 529.3%); zero-cost display convention not yet decided for T-04 specifically |
| 9 | Ads Sales % calculation validated | ⚠️ NEEDS REVIEW | Formula is correct, but real data shows it exceeding 100% (up to 175%) and being undefined (÷0) in 3/3 top products tested — not a rare edge case |
| 10 | Missing/unmatched data documented | ✅ PASS | 1,242/5,021 unmatched Ads item IDs (24.7%), root cause identified; Total Sales=0-with-Ads-Sales>0 case documented |
| 11 | Duplicate truth risk documented | ✅ PASS | **GREEN** — no existing page/report answers this business question |
| 12 | Evidence file saved | ✅ PASS | `evidence/jefri/T-04-data-discovery.md` |
| 13 | Validation file saved | ✅ PASS | This file |
| 14 | Next implementation step determinable from evidence | ✅ PASS | See recommendation below |

## Outstanding items before build (must be decided, not invented)

1. **Total Sales (Store) definition** — gross Postgres line-item revenue (`item_price × item_quantity`, status='Completed') vs net-of-tax (matching the "netSales" convention used elsewhere in this codebase, currently only proven via live Shopify GraphQL for a different store). These are different numbers and were not reconciled.
2. **Ads Sales % of Total Sales exceeding 100% / dividing by zero** — proven with 3 real top products (175%, 115%, and undefined/÷0). Needs an explicit product decision: show the raw (possibly >100%) percentage, cap it, flag it as an anomaly, or something else.
3. (Lower priority) Whether the 24.7% unmatched Google Ads item IDs (concentrated in campaign `23411228109`) need further resolution before that campaign's data can be trusted in T-04, or whether they should simply show as "Ads data unavailable" rows.

## Final decision

**GREEN** for discovery completeness and architecture direction. **AMBER** for build-readiness — the two items above must be resolved by Kuberan/GPT before implementation starts, per the discovery prompt's explicit stop conditions ("Shopify sales definition is unclear," "source data has material mismatch"). No HTML, API routes, or deployments were created in this session, per instruction.

## PASS/FAIL

**PASS** (discovery phase) — all 12 required phases executed with real, evidenced PostgreSQL queries; every required field traced to a real source or a documented, unresolved decision point; nothing invented.
