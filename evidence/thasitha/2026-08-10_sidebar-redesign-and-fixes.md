# Evidence — thasitha.html: Collapsible Left-Sidebar Redesign + Fixes (2026-08-10)

**Purpose:** Record of the navigation redesign for `thasitha.html`, replacing the horizontal tab bar, and the two follow-up bug fixes made the same day.

## 1. Sidebar redesign (`d2ffc62`)
New dashboard shell: dark navy collapsible sidebar with icon nav for all 5 requirements, brand header, back-link + dev-credit badge at the bottom, persistent top header bar with live-status chip and dynamic page title/date. Purely a shell/navigation change — `switchTab()` kept the same `tabPanelR1-R5` IDs/signature, so no R1–R5 data-loading logic needed touching. Old `.tabbar`/`.tabbtn` markup removed; corresponding CSS left in place (unused but harmless — other selectors in the same block are still referenced elsewhere).

## 2. Sidebar drift bug fix (`7971516`)
Sidebar used `position:sticky` (vertical-only anchoring); wide data tables inside requirement panels caused page-level horizontal scroll that dragged the sidebar sideways with it. Switched to `position:fixed` (immune to page scroll) with `.t-main` using `margin-left` instead of flex, plus `body{overflow-x:hidden}` as a second guard (each table already scrolls internally via `.t1-tablewrap`). Sidebar now defaults to closed/collapsed (icon rail) at all times, only opens on explicit toggle click, per instruction — never opens itself. Topbar height reduced ~40% (tighter padding, smaller title/date text).

## 3. Collapse-button misalignment + KPI entity-text fix (`b4a4856`)
Collapse toggle was cramped inside the 72px-wide brand row (`margin-left:auto` + `justify-content:center` conflict), spilling outside the sidebar visually. Pulled out as a standalone fixed-position handle pinned to the sidebar's right edge, independent of the sidebar's own flex layout — same fix pattern as the sidebar-drift fix. Req4's KPI cards (Sales Value/Conv. Value/Difference) set `.textContent = eur(...)` directly, leaving the literal `&euro;` entity text on screen since `textContent` doesn't decode HTML entities (unlike `innerHTML`). R1's KPI cards already had a `.replace('&euro;','€')` fix for this same issue — Req4 never got it; applied the same fix.

## Files touched
- `reports/digital-marketing-member-pages/pages/thasitha.html`

## Deployment
Deployed to production, verified live.

**Status:** PASS
**Reviewer:** Thasitha (pending review)
**Next step:** Unused `.tabbar`/`.tabbtn` CSS could be removed in a future cleanup pass (left in place intentionally this session, harmless).
