# Closure — Kamsi Req 2: Low CTR Page Identification (2026-07-03)

**Title:** Kamsi Req 2 closure · **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** CLOSED — live
**Purpose:** Close out Req 2. **Business Question:** collection/blog pages with high visibility but low CTR.

## Delivered
GSC API (sc-domain:ledsone.co.uk), June 2026 complete month, /collections/+/blogs/+/blog/ only (products excluded): **1,385 pages · 1,324 Low CTR (<2%) · avg CTR 0.33% · 577,976 impressions · 1,894 clicks.** Target keyword = top-impressions query per page. PG GSC mirror cross-checked (exact match) — API is single source of truth. Page in Dilaksi style with 5 KPIs, Flag/Type/CTR-range filters, sort, CSV, pagination. Hub + index extended (2 reports). Deployed on Kuberan approval, live verified.

**Live:** /pages/kamsi-req2-low-ctr-pages.html
**Pipeline:** `2026-07-03_kamsi_req2_gsc_fetch.py` → CSV → `2026-07-03_kamsi_req2_page_builder.py` (monthly rerun = change dates, run both).
**Evidence / Validation / Handover / Vercel:** all in Kamsi folders (2026-07-03 req2 files, deployment recorded).
**Key insight for Kamsi:** 96% of pages under 2% CTR — worklist = Flag:Low CTR sorted by impressions (top: B22 bulbs guide, 26k impressions, 0.27%).
**Next Steps:** July rerun in August; product pages only if Kuberan approves.
**PASS/FAIL:** PASS · RAG: GREEN
