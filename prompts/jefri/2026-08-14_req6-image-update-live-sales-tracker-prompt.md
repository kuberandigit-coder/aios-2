# Prompt Record — Jefri Requirement 6: T-06 Image Update Live Sales Tracker (2026-08-14)

**Title:** Jefri Req 6 — Image Update Live Sales Tracker
**Purpose:** Implement a new tab in `jefri.html` letting the DM team enter a Listing ID + Image Update Date and see whether sales improved/stayed same/dropped vs. an equal-length pre-update baseline, backed by live PostgreSQL data.
**Requirement source:** Full detailed spec supplied verbatim by Kuberan (30-section "Claude Code Implementation + AIOS Auto-Update Prompt" document), covering role, business logic, approved thresholds, UI, data-source discovery rules, PostgreSQL read-only constraints, duplicate-truth control, zero-baseline handling, date logic, validation tests, and mandatory AIOS documentation.
**Team member:** Jefri (Digital Marketing — Google Ads)
**Business question:** After a product's images are updated, did sales improve, stay about the same, or drop, compared to the same-length period immediately before the update?
**PostgreSQL source checked:** `listings.shopify_listings` (Listing ID → SKU), `order_management.orders` + `order_management.order_item_info` (Shopify sales, `sub_source_id=108`, `status='Completed'`) — all read-only `SELECT`s, no writes, verified via `mcp__ledsone-db-mcp`.
**Implementation scope:** New `jefriReq6HandlerModule` in `api/requirement.js` (`fn=jefri-req6`); new `req6Tab` section + `r6Init`/`r6Load`/`r6Render` JS in `pages/jefri.html`, reusing the existing Req5 tab/nav pattern. No new files, no new routes outside the existing `requirement.js` dispatcher.
**Files changed:**
- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/jefri.html`
(both `aios-2` and `Staff-requirements`)
**Evidence path:** `evidence/jefri/2026-08-14_req6-image-update-live-sales-tracker.md`
**Validation result:** PASS — see `validation/jefri/2026-08-14_req6-image-update-live-sales-tracker.md` (all 10 required tests + 4 additional edge cases, all against live production data post-deploy)
**Owner/Reviewer:** Kuberan (pending review by Jefri)
**Status:** DEPLOYED
**Known limits:** Parent-level (variation template) Listing IDs have no SKU in this store by design and correctly return "no SKU on record" rather than data; currency symbol shown as £ matching this project's UI convention even though the store is ledsone.de — flagged for review if Jefri wants €.
**Next step:** None outstanding — awaiting real-world usage feedback from Jefri.
**PASS/FAIL rule:** PASS only if existing assets were checked before building, PostgreSQL was read-only, Listing ID→SKU and sales sources were both verified (not guessed), the baseline window is exactly equal-length to Days Live, Trend thresholds are exactly ≥+15%/≤−15%/else Same, zero-baseline is handled safely (no Infinity/NaN), existing Jefri tabs still work, and all AIOS docs exist — all conditions met.
