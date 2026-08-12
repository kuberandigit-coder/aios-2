# Evidence — Favicon Missing on All Pages Except login.html (2026-08-12)

**Purpose:** Record of a bug fix: the real LEDSone logo favicon (added `9075c53`, earlier 2026-08-12) disappeared for users after logging in.

## Root cause
The favicon (`<link rel="icon" type="image/png" href="https://lh3.googleusercontent.com/...">`) had only ever been added to `login.html`. Confirmed via a full-project grep: all 29 other pages in `reports/digital-marketing-member-pages/pages/` had no `rel="icon"` tag at all, so the browser tab reverted to its default icon (or the last-cached one) as soon as the user navigated past login. User reported this via a browser-tab screenshot on `jefri.html`.

## Fix
Added the identical favicon `<link>` tag to all 29 pages:
- 23 pages with the standard async-auth fade-in pattern: inserted immediately before the `<style>html{visibility:hidden...}</style>` line.
- 6 pages without that pattern (`2025DE.html`, `cost.html`, `jackson-sales.html`, `sales2.html`, `sales25.html`, `salesuk.html`): inserted immediately after `<title>`.

Confirmed via grep that all 29 pages + `login.html` now have exactly one `rel="icon"` tag each.

## Files touched
All `.html` files in `reports/digital-marketing-member-pages/pages/` (29 files) — full list in commit `a2752ff`.

## Deployment
Deployed to production (both `aios-2` and `Staff-requirements`).

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None — same hotlink-risk note as the original favicon addition applies (logo is hosted on `lh3.googleusercontent.com`, not self-hosted).
