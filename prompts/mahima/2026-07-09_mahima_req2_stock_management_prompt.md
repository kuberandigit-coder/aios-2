---
task: Mahima Requirement 2 — Stock Management, Tab 2 on mahima.html
date: 2026-07-09
team_member: Mahima
---

## Title
Mahima Requirement 2 — Stock Management (Tab 2)

## Requirement source
Kuberan, 2026-07-09, direct instruction to Claude Code acting as execution worker for Mahima's
Digital Marketing Google Ads / Shopify reporting project.

## Business question
Which Shopify products need restocking, monitoring, no restock yet, or stop purchasing based on
current stock and last 30-day sales?

## Instruction received (summary)
Add Requirement 2 as **Tab 2: Stock Management** on the same
`C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html` page (Tab 1 =
existing Product Performance Report). Use real Shopify ledsone.de data only — no fake data, no
manually copied screenshot values, no invented sales or stock.

Required table columns: Date Range, Report Name, Purpose, SKU, Product Category, Current
Stock, Last 30-Day Sales, Avg Daily Sales, Days Remaining, Status, Action.

Exact calculation/status/action rules given (reproduced in full in the evidence doc) —
Avg Daily Sales = Last 30-Day Sales / 30; Days Remaining = Current Stock / Avg Daily Sales
("N/A" if Avg Daily Sales = 0); Status thresholds at 7/60 days; Action mapped 1:1 from Status.

Required UI: KPI cards (Total SKUs, Fast Moving, Healthy, Slow Moving, Never Moving, Restock),
filters (search, status, action, category), full table, data source note, calculation rules
note, known limitations note.

Scope note from Kuberan mid-task: work only on the local device copy at
`C:\Users\PC\Documents\piranav_aios\Staff-requirements\pages\mahima.html` — do not push to
git, do not touch the OneDrive deployed copy.
