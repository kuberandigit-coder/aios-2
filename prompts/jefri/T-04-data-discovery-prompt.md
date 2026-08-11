# Prompt — Jefri T-04 Data Availability & Source Discovery Only

**Saved:** 2026-08-11
**Purpose:** AIOS record of the exact discovery-phase prompt used to run Jefri T-04 (Parent Product ID based Google Ads + Shopify product performance analysis) discovery, before any build work.

---

## Original prompt (verbatim, as issued)

JEFri T-04 — DATA AVAILABILITY & SOURCE DISCOVERY ONLY

ROLE: You are the Discovery and Data Validation Engineer working for Jefri's Digital Marketing requirement. GPT is the planning/validation/prompt-generation/evidence-review/AIOS governance layer. Claude Code is the execution worker. DO NOT build the T-04 page yet. DO NOT deploy anything. Job: determine whether all required data for T-04 already exists in the approved PostgreSQL sources and/or existing AIOS assets.

**Requirement:** Jefri T-04 — Parent Product ID based Google Ads + Shopify product performance analysis. User enters one or more Parent Product IDs + a date range; system auto-discovers all variants under each parent; report shows parent rollup rows + variant rows; Shopify total sales and Google Ads performance shown together.

**Target fields:** Level, Parent Product ID, Product ID (This Row), SKU, Total Sales (Store), Ads Sales (Google Ads Conversion Value), Ads Clicks, Ads Impressions, Ads Cost, ROAS, Ads Sales % of Total Sales.

**Business question:** "For selected Parent Product IDs and a selected date range, how much total store revenue did each product/variant generate, how much revenue was attributed to Google Ads, how much Google Ads traffic/spend did it receive, and what percentage of total product revenue came from Google Ads?" Must support both parent-level rollup and variant-level detail.

**Required logic:** Total Sales (Store) = all Shopify revenue for the product/variant regardless of channel, filtered by Product/Variant ID + date range. Ads Sales = Google Ads conversion value attributed to the product/variant, matched via Item ID, filtered by date. Ads Clicks/Impressions/Cost = from Google Ads product report. ROAS = (Ads Sales / Ads Cost) × 100 — do not blindly reuse an existing ROAS field without checking its definition. Ads Sales % of Total Sales = (Ads Sales / Total Sales) × 100. Parent rollup = SUM of variant values for Total Sales/Ads Sales/Clicks/Impressions/Cost (never average); Parent ROAS = SUM Ads Sales / SUM Ads Cost × 100; Parent Ads Sales % = SUM Ads Sales / SUM Total Sales × 100.

**Phases required:** (1) read requirement source, (2) existing AIOS asset discovery, (3) PostgreSQL read-only discovery (SELECT/COUNT/DISTINCT only — no INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/TRUNCATE), (4) find Shopify product sales source, (5) find product/variant relationship source, (6) find Google Ads product data source + prove what Item ID represents (not assumed = Shopify Product ID), (7) match Shopify to Google Ads with real sample values + match rate, (8) date range validation for both sources, (9) calculation validation (ROAS, Ads Sales %, parent rollup, zero/null division handling), (10) duplicate truth risk (GREEN/AMBER/RED), (11) data availability matrix + join validation matrix, (12) existing asset matrix.

**Evidence requirements:** save to `evidence/jefri/T-04-data-discovery.md` with title, purpose, requirement source, requester, team, business question, source files checked, AIOS assets checked, PostgreSQL sources checked, exact schema/table/view/column names, sample validation queries/results, Product→Variant mapping evidence, Shopify→Google Ads mapping evidence, date coverage, calculation validation, missing/unmatched data, duplicate-risk, known limitations, recommendation, PASS/FAIL.

**Stop conditions:** requirement source unreadable; PostgreSQL unavailable; source table unidentifiable; Product/Variant ID relationship unclear; Google Ads Item ID mapping unclear; Shopify sales definition unclear; Google Ads conversion value definition unclear; date coverage insufficient; major required field missing; duplicate truth exists; business logic must be invented; **source data has material mismatch**; production changes required.

**DO NOT BUILD:** no HTML, no API routes, no serverless functions, no Vercel deploy, no PostgreSQL writes, no new source of truth.

(Full verbatim phase-by-phase instructions, matrices templates, and final-response format as issued by the user are preserved in the original chat transcript — this file captures the governing requirement, logic, and stop conditions for future reference.)

## Response

Findings recorded in `evidence/jefri/T-04-data-discovery.md` and `validation/jefri/T-04-data-availability-validation.md`.
