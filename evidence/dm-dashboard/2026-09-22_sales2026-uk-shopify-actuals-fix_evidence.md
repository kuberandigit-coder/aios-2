# Evidence — Sales 2026 UK: Shopify Actuals tab ("No data" bug chain)

Date: 2026-09-22
Repo: dm-dashboard, both `main` and `dev-work` (this one crossed both —
see Status note on the standing-rule change mid-session)

## Context

A new "Shopify Actuals" tab (ShopifyQL-based, full-year monthly sales
table) had been built by Piranav directly on `main` (not `dev-work`),
never synced. User reported it stuck on "No data — click Refresh".

## Bug chain found and fixed, in the order discovered

1. **Frontend never polled.** The backend computes this via the existing
   `BackgroundJob` pattern (too slow for one request); the first
   response is often `{"status":"computing"}`. The one-shot `fetch()`
   never checked again. Fixed: poll every 1.5s up to ~30s.
2. **Stale cached payload from before a code rewrite.** The cache held a
   payload from an OLD computation shape (order-aggregation, no
   `monthlyRows` key) — explains "No data" even without the polling bug.
3. **A genuinely hung background job** — live-polled the real
   `?refresh=1` endpoint for 5+ minutes with no resolution. Root cause:
   the hard-timeout fix I added FIRST TIME used
   `with ThreadPoolExecutor() as pool:` — its `__exit__` calls
   `shutdown(wait=True)`, which blocks until the orphaned thread
   finishes even after the timeout fires, making the fix worse than the
   original bug under any real slowness. Fixed: `shutdown(wait=False)`,
   verified with a real 999s-sleep simulated hang -> correctly returned
   control at exactly 3s (the timeout), not 999s.
4. **The real, final blocker (turned out to be the actual root cause of
   everything above appearing to hang): the Shopify token lacked the
   `read_reports` scope** ShopifyQL requires — confirmed live, instant
   `ACCESS_DENIED`. User confirmed `read_analytics` was granted but NOT
   `read_reports` (a different scope) — user then obtained the correct
   access and re-authorized.
5. **After access was granted, a genuine column-name bug surfaced**:
   `sales_reversals` was never a valid ShopifyQL column for the `sales`
   dataset. Tested every SHOW column individually against the real live
   API; the correct name is `returns`. Fixed the query and the
   `COL_MAP`.

## Live verification

- Full 9-month real dataset returned in 1.2s after all fixes (Jan-Sep
  2026, real GBP figures, e.g. Sep net sales £82,167.22 / 2,849 orders).
- Re-verified against **production** directly (not just locally) after
  each deploy round, including polling the live endpoint for minutes at
  a time to distinguish "still computing" from "actually stuck".

## Status

All 3 backend commits (`6ce8b8e`, `f08b1c5`, `477a977`) deployed and
live-verified working in production. This is the piece of work that
prompted the user's later standing instruction to push to `dev-work`
only going forward — earlier commits in this chain went to `main`
directly (with explicit permission each time, per the session's
established push-permission rule) since it was an active production
outage; from the point the instruction was given, all further
dm-dashboard work (including this task's own AIOS write-up) uses
`dev-work` only.
