# Prompt — Kamsi Requirement 5: Missing Meta Title & Meta Description Detection

**Title:** Kamsi Requirement 5 — Missing Meta Title & Meta Description Detection
**Purpose:** Identify which Shopify product pages are missing manually added SEO meta title/description (vs. Shopify auto-filled values)
**Requirement Source:** Kamsi Google Sheet sample / screenshot provided by Kuberan
**Business Question:** Which Shopify product pages are missing manually added SEO meta title or meta description?
**PostgreSQL Sources Checked:** Not used as final source — Shopify only, per instruction
**External Sources Checked:** None (GA4/GSC explicitly excluded per instruction; Shopify Admin GraphQL only, read-only)

## Instruction (verbatim summary)
Scope: all Shopify product pages. Source: Shopify only, read-only, no modification. Business rule: Shopify auto-fills SEO title/description from product title/description when not manually set — such auto-filled values count as MISSING. Detection: normalize (strip HTML, collapse whitespace, trim, lowercase for comparison) then compare SEO title vs. product title, and SEO description vs. product description (full text or first 160 chars). Required columns: Page URL, Collection Type, Product Title, Product Description, Meta Title, Meta Description, Title Length, Description Length, Last Updated, Action Needed. Action Needed logic per priority order (both blank → add both; one blank → add that one; auto-generated → rewrite that one; else OK). Build/extend Kamsi's HTML dashboard with KPI cards, search, filters, sortable table, CSV export, badges, evidence note. Save 6 AIOS files. No deployment without approval.

**Owner:** Kamsi · **Reviewer:** Kuberan
**Files Created:** see evidence file
**Evidence Location:** `evidence/Kamsi/2026-07-07_kamsi_req5_missing_meta_evidence.md`
**Validation:** `validation/Kamsi/2026-07-07_kamsi_req5_missing_meta_validation.md`
**Status:** Completed locally — not deployed (approval pending)
**Known Limitations:** see evidence file
**Next Steps:** Kuberan review; deployment approval
**PASS / FAIL:** PASS (see validation file)
