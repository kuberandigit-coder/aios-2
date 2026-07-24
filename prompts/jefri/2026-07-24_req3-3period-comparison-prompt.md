---
title: Jefri Requirement 3 (T-03) — 3-Period Product Comparison, implementation prompt
date: 2026-07-24
type: prompt
---

# Context
GPT-reviewed business requirement, handed to Claude Code as implementation engineer under AIOS governance. Scope: add Requirement 3 (T-03) to `jefri.html` only — no changes to Req1/Req2/navigation/database schema.

# Business Requirement (as given)
Compare product performance across three periods to identify products that Improved / Stayed the same / Dropped, while also classifying products into Performance Tiers, to help decide which products should get additional ad budget vs. which need investigation.

## Data periods
- Previous 3 Months: Oct-Dec 2025 — columns: Product ID, SKU, Conv. Value, ROAS
- Last 3 Months: Jan-Mar 2026 — columns: Product ID, SKU, Conv. Value, ROAS, Status
- Next 3 Months in Previous Year: Apr-Jun 2025 — columns: Product ID, SKU, Conv. Value, ROAS

## Performance Tier rules
- High: ROAS >= 400% AND top 20% revenue contribution ("Hero products")
- Mid: ROAS 200-399% AND middle 30-50% revenue contribution ("Stable performers requiring optimisation")

## Status rules (Last 3M vs Previous 3M, using Conv. Value OR ROAS)
- Improved: change >= +15%
- Same: change between -10% and +14%
- Drop: change <= -30%

## Status colours
Improved = green, Same = blue, Drop = red.

## Table features required
Performance Tier, Product ID, SKU, Conv. Value, ROAS, Status columns; responsive table; sticky header; sortable columns; search box; Export CSV; Export Excel; pagination; professional styling matching existing Jefri dashboard theme.

## Governance constraints (as given)
- Inspect PostgreSQL read-only; identify correct source tables/views; do not modify database; do not invent business logic.
- Search AIOS first for existing Requirement 3/T-03/comparison tables/reusable components before coding.
- Modify only `pages/jefri.html`, related JS, related API endpoint, CSS if required.
- Do not change Req1, Req2, or dashboard navigation; do not remove existing filters; do not change database schema.
- Auto-update AIOS documentation (prompts/evidence/validation/handover/reports/vercel, each with the specified fields) and save evidence.
- STOP if requirement unclear, database source can't be identified, a duplicate implementation exists, business logic would need to be invented, or production data modification is required.

# What was found during discovery
No existing Req3/T-03/comparison implementation for Jefri anywhere in the repo. `google_ads.product_performance` (same table Req1 already uses) has real data for all three periods except a genuine gap (2025-04-01 to 2025-05-11, campaigns not yet tracked) in the Prior-Year 3M window — disclosed, not invented around.

# Outcome
Implemented as `fn=jefri-req3` (backend) + `req3Tab` (frontend), reusing Req1's SKU-resolution SQL and campaign scope. See `reports/jefri/2026-07-24_req3-summary.md` for the full outcome and known limitations.
