# Evidence — Blog Optimization: blank Performance table on "View Changes"

Date: 2026-10-07
Commit: `37ccfce`, pushed to `dev-work`.

## User report

Clicking "View Changes" from the Completed tab opened the detail drawer, but the Performance
table (Clicks/Impressions/Position/CTR) was completely blank, even though the blog had real
historical GSC data.

## Root cause

The Completed tab's "View Changes" button opens `DetailDrawer` with `selected = { page: c.page
}` — only the page URL, no performance numbers. The Performance table and the Likely Cause
payload both read their numbers straight off that `row` prop, which is only fully populated when
the drawer is opened from the main Clicks-Down list (where the row already carries
`previousClicks`/`currentClicks`/etc.). From Completed, those fields were simply `undefined`.

## Fix

Both the Performance table and `runCauseCheck()`'s payload now prefer `detail.performance` (the
full data `GET /blogs/detail` already fetches for the page, regardless of how the drawer was
opened) and only fall back to the `row` prop if `detail` hasn't loaded yet. Zero change for the
main Clicks-Down list flow, since `detail.performance` and `row` carry the same field shape.

## Status

Implemented, pushed to `dev-work`. Frontend build confirmed clean.
