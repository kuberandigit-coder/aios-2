# Evidence — salesuk.html: Navy Sidebar Hidden in Locked ?group= View (2026-08-12)

**Purpose:** Record of a follow-up fix matching `sales2.html`'s locked-view sidebar-hide, applied to `salesuk.html`.

## Background
User compared UK staff (Sonya/Kamsi/Dilaksi) opening their "Sales 2026" tab (embedded `salesuk.html?group=<name>`) against Jefri's DE Sales tab (embedded without any sidebar at all) via side-by-side screenshots, and asked for the same clean, sidebar-free look on the UK side.

`salesuk.html` already had a pre-existing locked-view mechanism (`?group=<name>`) that filters the page's own internal group tabs (`#groupTabs .reqtab`, e.g. DM-Ad/Meta) down to one group — but this only affected the internal content tabs, not the outer navy sidebar added in the earlier `656b445` redesign, which still showed the full Members/Other Reports navigation.

## Fix (`31686e7`)
Extended the existing `?group=` locked-view IIFE to also hide `#tSidebar` and `#tCollapseBtn`, and force-expand `.t-main` to full width via `element.style.setProperty('margin-left', '0', 'important')` — same pattern as the `sales2.html` fix earlier the same day.

## Files touched
- `reports/digital-marketing-member-pages/pages/salesuk.html`

## Deployment
Deployed to production, confirmed live via `curl` grep on `dm-dashboard.vintageinterior.co.uk`.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
