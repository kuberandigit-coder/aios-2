# Validation — sales2.html: Navy Sidebar Hidden in Locked ?staff= View (2026-08-12)

**Purpose:** Validation record for `evidence/digital-marketing-member-pages/2026-08-12_sales2-locked-view-sidebar-hidden.md`.

## Checks performed
- Confirmed `node --check` passes on the extracted script block (no syntax errors introduced).
- Confirmed `#tSidebar` and `#tCollapseBtn` are set to `display:none` only when a valid `?staff=` param is present and matches a real member tab.
- Confirmed `.t-main` correctly expands to full width via the `!important`-forced inline style, overriding the base CSS rule.
- Confirmed standalone (non-locked) access to `sales2.html` is unaffected — sidebar still renders normally.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
