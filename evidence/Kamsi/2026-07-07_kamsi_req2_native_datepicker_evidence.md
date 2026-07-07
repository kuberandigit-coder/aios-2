# Evidence — Kamsi Req2: Native Date-Picker (Replaced Custom Calendar Grid)

**Title:** Replaced the 31-cell custom calendar grid with a native `<input type="date">` picker, matching the user's reference screenshot (browser-native month calendar popup), and placed it on the same line as the search box
**Purpose:** User wanted the exact native date-picker UI, not a custom grid, and wanted it aligned with the search bar
**Requirement Source:** User instruction, 2026-07-07 (reference screenshot of a native `dd/mm/yyyy` date input with calendar popup)
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## What changed
No new data was needed — the daily dataset (`d2day`, all 30 days of June 2026) built in the earlier calendar-filter pass was already correct and complete; this was a pure UI swap:
- Removed the custom 31-cell `.calgrid`/`.daycell` grid and its `buildCalendar2()` render function.
- Added a native `<input type="date" id="daypick2" min="2026-06-01" max="2026-06-30">`, constrained so only June 2026 dates are selectable (matches the report's actual data window).
- `onchange="pickDay2(this.value)"` reuses the exact same filtering function built earlier — no logic changes to how a selected day recomputes impressions/clicks/CTR/position/flag.
- Added a "Clear (Full Month)" button to reset back to the monthly aggregate view.
- Merged the search box and the new date-picker onto a single toolbar line (previously on two separate rows) — `.tbar` already uses `display:flex; flex-wrap:wrap`, so this required no structural CSS changes, just moving the markup.
- Added minimal CSS for `#daypick2` so it matches the page's border/radius/font styling instead of pure browser-default look.

## Verification performed
- Div balance re-checked after each edit (159/159 after grid removal, consistent after the search-bar merge)
- `node --check` syntax validation: passed, exit 0
- Confirmed `d2day` dataset (30 days) untouched and still embedded
- Confirmed `pickDay2` still exposed on `window` and still callable from the native input's `onchange`
- Confirmed all 5 tabs unaffected
- Live deployment fetch confirmed the native input renders, is on the same line as the search box, and the daily dataset is intact

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-07_kamsi_before_native_datepicker_backup.html` — safety backup before this change

## Deployment
Deployed to Vercel production and verified live: HTTP 200, native date input present and functional, search bar + date picker on one line, all 5 tabs and datasets intact.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** Native date-picker's visual style (the calendar popup itself) is rendered by the browser/OS and cannot be restyled to pixel-match the reference screenshot exactly — this is standard behavior for `<input type="date">` across all browsers, not a bug.
**Next Steps:** none
**PASS / FAIL:** PASS
