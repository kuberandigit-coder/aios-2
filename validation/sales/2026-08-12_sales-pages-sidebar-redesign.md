# Validation — sales2.html / salesuk.html / sales25.html / 2025DE.html: Sidebar Redesign (2026-08-12)

**Purpose:** Validation record for `evidence/sales/2026-08-12_sales-pages-sidebar-redesign.md`.

## Checks performed
- Confirmed sidebar renders identically across all 4 pages, with SVG icons (no emoji) for Members/Reports nav items.
- Confirmed `sales2.html`'s locked `?staff=` view (used when embedded as an iframe in Jefri/Mahima/Sukirtha/Thasitha/Dilaksi/Kamsi's pages) correctly hides other members' nav items and the "Other Reports" section.
- Confirmed sidebar has no collapse button and stays permanently expanded on all 4 pages, per the explicit follow-up request.
- Confirmed div/script tag balance via a Node-based balance check before deploy on each file (established pattern for this project).
- Deployed and confirmed live at `dm-dashboard.vintageinterior.co.uk`.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
