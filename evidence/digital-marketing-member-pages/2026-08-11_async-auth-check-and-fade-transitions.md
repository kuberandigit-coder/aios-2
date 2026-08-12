# Evidence — Async Auth-Check + Fade Transitions, All 24 Pages (2026-08-11)

**Purpose:** Record of a system-wide performance/UX fix in response to "system is loading too much, need load-free smooth navigation."

## Problem
Every page's auth guard used a blocking synchronous XHR (`xhr.open('GET', ..., false)`) at the top of the page, which froze HTML parsing/rendering until the network round-trip to `/api/auth?action=session` completed — visible as a blank white page for a noticeable moment on every navigation.

## Fix (`bce5bc2`)
Converted the blocking synchronous XHR pattern into a non-blocking async `fetch(...).then(...)` across all 24 pages, preserving each file's exact authorization logic (staff_key checks, landing maps, `role === 'admin'` checks) via literal string header/tail replacement. Added a fade-in on page reveal (`html{visibility:hidden;opacity:0;}html.dm-ready{opacity:1;transition:opacity .16s ease;}` + `requestAnimationFrame` reveal) and a symmetric fade-out before login/logout navigation, replacing instant snaps.

## Scope note
This was the first of a 3-part approved request. Part 2 (login/logout polish) is covered by the same commit's fade transitions. Part 3 (investigate large page-file sizes — kamsi.html ~15MB, mahima.html ~14MB, dilaksi.html ~4MB) was approved but never started — see Outstanding.

## Files touched
All 24 pages in `reports/digital-marketing-member-pages/pages/` with an auth guard, plus `login.html`.

## Deployment
Deployed to production, verified live across multiple pages.

**Status:** PASS (parts 1–2); Part 3 not started
**Reviewer:** Muguntha (pending review)
**Next step:** Investigate large page-file sizes (kamsi.html/mahima.html/dilaksi.html) — Part 3, not yet started.
