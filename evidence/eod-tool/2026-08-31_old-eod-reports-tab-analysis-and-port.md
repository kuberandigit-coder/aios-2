# Evidence — Old "EOD Reports" tab: analysis + static-HTML port into new Admin panel

**Date:** 2026-08-31
**Purpose:** User asked for a careful analysis of the old system's
top-level "EOD Reports" admin tab (`pages/eod.html` + its three per-team
"log" pages, explicitly outside the already-ported `pages/eod/` folder)
and its connections, then to add the same feature into the new
dm-dashboard admin panel **as the same HTML** -- no React rewrite.

## Analysis: what the old system actually is

Four files in `reports/digital-marketing-member-pages/pages/`:

- **`eod.html`** (747 lines) — single-member EOD browser. Sidebar lists
  all 13 staff grouped by team (TEC/SEO/ADS). Selecting a member loads
  their available report dates and a custom markdown renderer displays
  the selected report. Links out to the three team-log pages below.
- **`eod-tec.html`** / **`eod-seo.html`** / **`eod-ads.html`** (1118 /
  941 / 1399 lines) — per-team scorecards. Pull *every* member's *every*
  report, run **member-specific regex parsers** (`parseKuberan`,
  `parsePiranav`, etc. -- each staffer's markdown format drifted
  differently over the months) into individual task rows, with month and
  person filters plus KPI totals.

## Connections found (the actual point of the analysis)

1. **Admin gate**: a self-invoking script on every page called
   `fetch('/api/auth?action=session')` (the old system's Node/Vercel
   backend) and redirected to `../login.html` on failure -- both endpoints
   are specific to the old stack and don't exist in the new FastAPI +
   React app.
2. **`eod.html`'s own data fetching**: direct, unauthenticated client-side
   calls to `api.github.com/repos/digitalmarketing69140951-sys/eod-reports`
   -- confirmed still working today (repo is public: unauthenticated
   `GET .../contents/eods/Kuberan` returns 200, 77 files). No backend
   involved at all for this page.
3. **The three team-log pages' one backend dependency**: a call to
   `/api/auth?action=eod-dates&member=X` (old Node handler,
   `handleEodDates` in `api/auth.js`) to list a member's report dates --
   with a hardcoded `KNOWN_DATES` per-member fallback already built in if
   that call fails. Actual report *content* for each date is fetched
   directly from `raw.githubusercontent.com` (no backend, same pattern as
   #2).

## What was ported (verbatim HTML/JS, not React)

Per the explicit instruction ("no need that in react, add the same html
for that only"):

1. Copied all 4 files as-is into `frontend/public/eod-reports/` -- Vite
   serves the `public/` directory verbatim at the site root, so these are
   reachable at `/eod-reports/eod.html` etc. with zero React involvement.
2. Removed the dead admin-gate script (8 lines) from all 4 files -- it
   pointed at a login page (`../login.html`) that doesn't exist in this
   app, and the link to this page is only ever reachable from inside the
   already admin/dev-gated Admin/Dev panel nav in the first place.
3. Replaced the one broken backend call
   (`/api/auth?action=eod-dates&member=`) in the three team-log pages with
   a direct call to the GitHub Contents API, using the URL constant that
   was **already defined but unused** in each file (`GH_API_BASE_TEC` /
   `GH_API_BASE_SEO` / `GH_API_BASE`) -- same `KNOWN_DATES` fallback
   behavior preserved untouched. Zero new backend code needed.
4. Everything else (member-specific parsers, KPI logic, markdown
   renderer, styling, sidebar) is byte-for-byte the same as the old
   system.

`frontend/src/admin/AdminLayout.jsx` and `frontend/src/dev/DevLayout.jsx`:
added one nav item, "EOD Reports" (`external: true`), placed right after
"EOD Admin" -- clicking it `window.open`s `/eod-reports/eod.html` in a new
tab instead of switching to a React panel. No panel/component was
written for it.

## Verification
- `npx vite build` -> `✓ built in 571ms`, no errors.
- Confirmed all 4 static pages serve correctly from the running dev
  server: `curl` -> 200 for `/eod-reports/eod.html`, `eod-tec.html`,
  `eod-seo.html`, `eod-ads.html`.
- Confirmed the GitHub Contents API call these pages now depend on
  actually works (77 files returned for Kuberan, unauthenticated).

## Known limitation (flagged honestly, not silently accepted)
The static pages themselves carry no auth check at all now (the old
gate was removed because it pointed at nothing that exists here) --
they're reachable by anyone who knows/guesses the URL, not just admins,
even though the nav link to them only appears for admin/dev. This matches
the same trust model already documented in `backend/app/eod.py`'s own
docstring (nothing in this app currently verifies identity
cryptographically server-side), so it's not a new gap introduced here,
but it is real and worth the user's awareness.

## Reviewer
Pending user confirmation -- click "EOD Reports" in Admin/Dev nav,
confirm it opens in a new tab and a few members' reports load correctly.
