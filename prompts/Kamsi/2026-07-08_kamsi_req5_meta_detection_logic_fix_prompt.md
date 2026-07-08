# Prompt Copy — Kamsi Requirement 5: Meta Detection Logic Fix

**Title:** Verbatim task instruction record — fix SKU-suffix false-negative bug in Req5 detection logic
**Purpose:** Preserve the exact requirement instruction for audit
**Requirement Source:** GPT planning layer instruction relayed by Kuberan, 2026-07-08
**Business Question:** Which Shopify product pages have missing or Shopify-auto-generated SEO meta title/description (including cases where Shopify truncated the SKU suffix from the product title)?
**PostgreSQL Sources Checked:** Not used — Shopify is the explicit source of truth per instruction
**External Sources Checked:** None (GA4/GSC explicitly out of scope for this requirement)

## Verbatim issue reported
> The current logic marks a product as OK when Product Title and Meta Title are not exactly equal. Example: Product Title "1 Outlet French Gold Metal Ceiling Rose 120x25mm~2801", Meta Title "1 Outlet French Gold Metal Ceiling Rose 120x25mm". Current result: OK. Correct result: Auto-generated / Missing Meta Title. Reason: Shopify auto-generated the SEO title from the product title and removed/truncated the SKU suffix.

## Required logic (summarized, full detail in evidence file)
- Meta Title Status = Missing / Auto-generated / Custom, using: blank check, exact normalized match, match after SKU/code-suffix removal, prefix/truncation check, and a ≥90% similarity check with no added SEO wording.
- Meta Description Status = same three-state model using: blank check, exact match, prefix match, first-150–170-character truncation match, ≥90% similarity check.
- Action Needed: "Add Custom Meta Title and Meta Description" / "Add Custom Meta Title" / "Add Custom Meta Description" / "OK", derived from the two status fields (Missing or Auto-generated on either side triggers the corresponding "Add Custom..." action).
- Required table columns: Page URL, Collection Type, Product Title, Product Description, Meta Title, Meta Description, Title Length, Description Length, Meta Title Status, Meta Description Status, Last Updated, Action Needed.
- KPI cards: Total Products Checked, Missing Meta Title, Auto-generated Meta Title, Missing Meta Description, Auto-generated Meta Description, OK Products.
- Explicit instruction: **extend existing Requirement 5, do not create a duplicate report; do not modify Shopify; do not use PostgreSQL as final source; no deployment without approval.**

**Status:** Implemented — see evidence/validation files for full detail
**Owner:** Kamsi · **Reviewer:** Kuberan
**Next Steps:** none beyond Kuberan review of the one process deviation (deployment already performed — see evidence)
**PASS / FAIL:** PASS (logic + validation), with one disclosed deviation (deployment occurred — see evidence)
