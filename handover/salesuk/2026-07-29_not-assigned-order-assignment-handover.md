# Handover — salesuk.html: Not Assigned Order Assignment UI

**Title:** Assign-from-UI
**Status:** BLOCKED on one user action, otherwise live and deployed (2026-07-29)
**Reviewer:** Not recorded.

## Pending user action (required before this feature actually works)
Add a **GitHub Personal Access Token** with write (contents) access to `digitalmarketing69140951-sys/Staff-requirements` as a Vercel environment variable named `GITHUB_ASSIGN_TOKEN`, on the `digital-marketing-member-pages` project. Do this directly in Vercel's dashboard (Project → Settings → Environment Variables) — do not send the token value through chat. Until this is set, clicking "Assign" will return a clear "Server not configured" error rather than failing silently.

## What was built
- New `api/assign-order.js` endpoint — commits a manual order→group assignment to `api/data/order-overrides.json` in the GitHub repo.
- `api/salesuk.js` and `api/sales25.js` both check this overrides file (keyed by Shopify order ID + a `source` tag) before running their normal campaign/UTM rules, so a manual assignment always wins.
- `salesuk.html`'s Not Assigned tab now has an "Assign" column: pick who it belongs to, click Assign, see inline Saving/Saved/Failed feedback.

## Known limitation — read before using
Assigning an order commits the override immediately, but **does not instantly move it** in an already-generated historical month's tabs (Jan–Jun 2026, Jan 2025) — those use pre-generated static snapshot JSON files for speed, and the override check only runs during a *live* fetch. After a batch of assignments, the affected month's snapshots need regenerating via `scripts/bulk-salesuk-refresh.js <month>` (2026) or `scripts/bulk-sales25-refresh.js <month>` (2025) — the same manual step every prior rule change in this project required. The current live month (2026-07) always fetches live, so assignments there take effect on the next page load with no extra step.

## Next steps
1. User adds `GITHUB_ASSIGN_TOKEN` to Vercel.
2. Test one real assignment end-to-end.
3. After any batch of assignments on a historical month, re-run that month's bulk-refresh script to regenerate snapshots.
