# Evidence — sales2.html: Navy Sidebar Hidden in Locked ?staff= View (2026-08-12)

**Purpose:** Record of a follow-up UX reversal on `sales2.html`'s embedded/locked view.

## Background
Earlier the same day (`1481177`), `sales2.html` was redesigned with a navy collapsible sidebar applied universally, per explicit choice of "full sidebar everywhere, including inside iframes." User then reported (via screenshot) that when a staff member opens their own "Sales 2026" tab (which embeds `sales2.html?staff=<name>`), the navy sidebar still showed the full Members/Other Reports navigation — creating a confusing duplicate-navigation experience, since the staff member is already inside their own dashboard's sidebar for actual navigation and only wants to see their own sales numbers.

## Fix
Reworked the locked-view IIFE at the bottom of `sales2.html`: instead of selectively hiding individual nav items/labels within the sidebar, it now hides the entire `#tSidebar` element and the collapse button (`#tCollapseBtn`), and force-expands `.t-main` to full width via `element.style.setProperty('margin-left', '0', 'important')` (needed because the base CSS rule `.t-main{margin-left:var(--sb-w) !important;}` uses `!important`, so a plain inline-style override wouldn't have worked).

## Behavioural note
This only applies to the `?staff=` locked view (embedded per-member). Standalone access to `sales2.html` (no `?staff=` param, e.g. via Kuberan/Piranav/Muguntha's Team Tools) is unaffected — sidebar still shows normally there.

## Files touched
- `reports/digital-marketing-member-pages/pages/sales2.html`

## Deployment
Deployed to production (both `aios-2` and `Staff-requirements`).

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
