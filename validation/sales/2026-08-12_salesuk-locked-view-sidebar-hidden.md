# Validation — salesuk.html: Navy Sidebar Hidden in Locked ?group= View (2026-08-12)

**Purpose:** Validation record for `evidence/sales/2026-08-12_salesuk-locked-view-sidebar-hidden.md`.

## Checks performed
- Confirmed `node --check` passes on the extracted script block.
- Confirmed sidebar and collapse button are hidden, and content expands full-width, when a valid `?group=` param locks the view.
- Confirmed standalone (non-locked) access to `salesuk.html` is unaffected.
- Confirmed live via `curl` on `dm-dashboard.vintageinterior.co.uk/pages/salesuk.html?group=sonya`.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
