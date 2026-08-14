# Report — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Title:** Jefri Req 6 — Image Update Live Sales Tracker
**Purpose:** New live-data tab in `jefri.html` comparing a listing's sales before vs. after an image update, over an automatically equal-length window.
**Requirement Source:** Kuberan-supplied full implementation spec (30-section AIOS Claude Code execution prompt).
**Team Member:** Jefri (Digital Marketing — Google Ads)
**Business Question:** Did sales improve, stay the same, or drop after a product's images were updated?
**PostgreSQL Source Checked:** `listings.shopify_listings` (Listing ID → SKU), `order_management.orders` + `order_management.order_item_info` (Shopify sales) — read-only, verified via live `SELECT`s before implementation.
**Files Created/Modified:**
- `reports/digital-marketing-member-pages/api/requirement.js` — new `jefriReq6HandlerModule`, routed as `fn=jefri-req6`
- `reports/digital-marketing-member-pages/pages/jefri.html` — new `req6Tab` UI + `r6*` JS functions
(both `aios-2` and `Staff-requirements` repos, kept in sync via `scripts/check-repo-sync.js`)
**Evidence Path:** `evidence/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`
**Validation Result:** PASS (10/10 required tests + 4 edge cases, all against live production data — see `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`)
**Owner/Reviewer:** Kuberan (pending review by Jefri)
**Status:** DEPLOYED
**Known Limits:** Parent-level (variation template) Listing IDs have no SKU in this store — correctly reported as an error, not a bug. Currency shown as £ per this project's existing UI convention.
**Next Step:** None outstanding.
**PASS/FAIL Rule:** PASS requires discovery-before-build, no guessed data sources, exactly-equal-length baseline window, unmodified Trend thresholds, safe zero-baseline handling, no regressions to existing Jefri tabs, and complete AIOS documentation — all satisfied.
