# Evidence — sales2.html / salesuk.html / sales25.html / 2025DE.html: Sidebar Redesign (2026-08-12)

**Purpose:** Record of the navigation redesign applied to all 4 non-staff-scoped sales report pages.

## Build history (same day)
1. **`sales2.html` redesign** (`1481177`): redesigned with the same navy collapsible sidebar as `thasitha.html`, applied universally — including when embedded via `?staff=` iframes in Jefri/Mahima/Sukirtha/Thasitha/Dilaksi/Kamsi's pages — per explicit choice of "full sidebar everywhere, including inside iframes" over the recommended standalone-only option. The locked single-member `?staff=` view now hides other members' nav items/labels and the "Other Reports" section automatically.
2. **Icon pass** (`41794e9`): initial build used emoji icons; replaced with professional stroke-style SVG icons matching `thasitha.html`'s icon set, per follow-up request.
3. **`salesuk.html`/`sales25.html`/`2025DE.html` redesign** (`656b445`): same navy sidebar + SVG icon set applied to all three, replacing their old `.back` link + reqtabs group-filter bar. Group-filter tabs inside the page content (DM-Ad/Meta group selectors, month tabs) were left untouched — only page-level navigation changed.
4. **Sidebar set to always-expanded** (`a396869`): per explicit follow-up, removed the collapse/expand toggle on all 4 pages — sidebar is permanently full-width with no collapse button here, unlike the icon-rail-by-default pattern used elsewhere in the project.

## Files touched
- `reports/digital-marketing-member-pages/pages/sales2.html`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `reports/digital-marketing-member-pages/pages/sales25.html`
- `reports/digital-marketing-member-pages/pages/2025DE.html`

## Deployment
Deployed to production, verified live at `dm-dashboard.vintageinterior.co.uk` for all 4 pages, including the iframe-embedded `?staff=` locked views.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None called out.
