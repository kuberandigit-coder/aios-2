# Dilaksi — July Live Month-to-Date + Refresh Button — Evidence

**Date:** 2026-07-17
**Purpose:** Extend Dilaksi's product-sales tab on the shared dashboard (`reports/digital-marketing-member-pages/pages/sales.html`) with a "July (live)" month-to-date view, mirroring the pattern already built for Kamsi (`evidence/Kamsi/...july-live...` — see `api/sales-kamsi.js` `CURRENT_LIVE_MONTHS`) and just extended to Sukirtha's DE Organic/Email sections.

## What was built

### 1. `reports/digital-marketing-member-pages/api/sales-dilaksi.js`
- `SUPPORTED_MONTHS` extended from `['2026-01'..'2026-06']` to include `'2026-07'`.
- Added `CURRENT_LIVE_MONTHS = ['2026-07']` (identical comment/rationale to `sales-kamsi.js`: explicit, reviewable list, not auto-rolled by date).
- `resolveReportMonth()` updated to match Kamsi's month-to-date logic exactly:
  - `isLive = CURRENT_LIVE_MONTHS.includes(month)`
  - `endMs = isLive ? Math.min(monthEndMs, Date.now()) : monthEndMs` — live month's end boundary capped at "now" (London), never reaches into the future even mid-month.
  - `endDay` computed via `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London' })` when live, else the full month's day count.
  - `label` becomes `"July 1–N (month to date), 2026"` when live, vs `"July 1–31, 2026"` style for closed months.
- `responsePayload` now includes a top-level `isLive: monthConfig.isLive` field (matches `sales-sukirtha-de-organic.js` / `sales-kamsi.js` pattern).
- No static snapshot file exists for `2026-07` (`api/data/dilaksi-sales-2026-07.json` was never created) — the existing `fs.existsSync(staticPath)` check in the handler falls through automatically to a live Shopify fetch for July, exactly as it does for Kamsi. No handler-body changes were needed beyond the `isLive` field addition.

### 2. `reports/digital-marketing-member-pages/pages/sales.html`
- Added a "July (live)" month tab (`data-month="2026-07"`, active by default) to `#dMonthTabs`, matching Kamsi's `#kMonthTabs` row.
- Added `<button id="dRefreshBtn" class="primary" style="display:none;" onclick="dLoad(true)">Refresh</button>` next to `#dLiveChip` in Dilaksi's header — checked for ID collisions against `K_`/`D_`/`S_`/`SDO_`/`SDE_` prefixed identifiers used elsewhere in the file: `dRefreshBtn` is unique (no other file reference).
- `D_CURRENT_MONTH` default changed from `'2026-06'` to `'2026-07'` (matches the new active tab).
- Added `const D_LIVE_MONTHS = ['2026-07'];`.
- `dLoad(force)` rewritten to mirror `kLoad(force)`:
  - Shows/hides `#dRefreshBtn` based on `isLive`.
  - Disables the refresh button while a request is in flight, re-enables in `finally` and on abort.
  - Chip text: "Loading live data from Shopify…" / "Live data retrieved from Shopify — click Refresh for the latest" when live, vs the existing historical wording when not.
  - `#dPeriodSub` now reads "...the current month, updated only when you click Refresh — not auto-updating." for the live month, vs "...a completed, closed reporting period — not a live/updating view." for historical months (verbatim match to Kamsi's wording).
- Initial page load (`dLoad(false)` call at the bottom of the script) now loads July month-to-date data by default, since `D_CURRENT_MONTH` defaults to `'2026-07'`.

## Verification performed (production)

- Deployed to Vercel production: `vercel --prod --yes` → `https://digital-marketing-member-pages.vercel.app`.
- Curled `/api/sales-dilaksi?month=2026-07` (live month-to-date) → `success:true`, `isLive:true`, no errors, real order data returned.
- Curled production `pages/sales.html` and confirmed the "July (live)" tab, `dRefreshBtn`, and updated `dLoad` logic are present in the served HTML.

(See final assistant report in this session for the exact curl output / order counts captured at verification time.)

## Files modified
- `reports/digital-marketing-member-pages/api/sales-dilaksi.js`
- `reports/digital-marketing-member-pages/pages/sales.html`
- `evidence/Dilaksi/2026-07-17_dilaksi-july-live-month-refresh-button-evidence.md` (this file)

## Status: PASS
- July live month-to-date works for Dilaksi, mirroring Kamsi's `CURRENT_LIVE_MONTHS`/`resolveReportMonth` pattern exactly.
- No static snapshot required or created for July — falls through to live fetch by design.
- No ID/global collisions introduced (`dRefreshBtn`, `D_LIVE_MONTHS` are unique against `K_`/`S_`/`SDO_`/`SDE_` prefixed code elsewhere in `sales.html`).

**Reviewer:** self-verified via live production curl checks.
**Next step:** none — Dilaksi July-live build is complete.
