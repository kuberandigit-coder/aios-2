# Daily Work Log — 2026-07-28 (continuing from 2026-07-27)

## Summary
Grew the standalone `salesuk.html` order-level review page (first built 2026-07-27 as a 2-group January-only prototype) into an 11-group, 7-month system covering the whole `ledsone.co.uk` UK store with zero double-counting, went live for July, and wired it into the existing hourly auto-refresh workflow.

## Tasks Completed
1. **Group expansion**: DM-Ad, Meta → added Sonya, Sajeepan, Sukirtha (all Email), Organic, CPPC, Thishoban, Theekshy, Thanishtika — each discovered by repeatedly auditing what was left unassigned and asking the user who owns it.
2. **Restructure**: flipped from Month-main/Group-sub to Group-main/Month-sub tabs; fixed a cache-key bug in the process.
3. **Full Jan-Jun backfill** for every group via a sequential bulk-refresh script; **February and January reconciled to 0 unassigned orders**; March-June reduced to 0-1.
4. **Matching techniques developed**: second-session and last-session lookthrough (check later customer-journey sessions when the first has no campaign), permanent vs month-scoped rules, substring/whitelist source matching with real-data verification at every step.
5. **Two real bugs found and fixed**: `matchValue()` missing the `journey` argument (mislabeled every group's display), and a Shopify "Multifeeds" free-listing tag mislabeling a genuine Google-organic order.
6. **July went live**: added as the current month-to-date (mirrors `sales.html`'s July convention), wired into the hourly GitHub Actions workflow via a new `salesuk` mode in `generate-snapshots.js` — all groups now refresh automatically every hour.
7. **"Not Assigned" tab** (11th group): a virtual group that's the logical complement of all real groups — guarantees no order can silently disappear.
8. **Dual-deploy hazard discovered and fixed**: `api/salesuk.js` vanished from production mid-session with no code change — root cause was the Vercel project being git-linked to a second repo (`Staff-requirements`) with its own hourly cron auto-deploy, which had never received the salesuk files. Fixed by syncing both repos after every subsequent change.
9. **sales.html tab removal**: the 5 superseded per-staff tabs (Sajeepan/Theekshy/Sonya/DM/Meta·UK) and Sukirtha's UK sub-tab permanently removed from the main dashboard; a "UK Sales" nav tab added linking to `salesuk.html`.

## Files Touched
- `reports/digital-marketing-member-pages/api/salesuk.js`, `pages/salesuk.html` (grew substantially)
- `reports/digital-marketing-member-pages/pages/sales.html` (tabs removed)
- `reports/digital-marketing-member-pages/api/scripts/generate-snapshots.js`, `scripts/bulk-salesuk-refresh.js`
- `reports/digital-marketing-member-pages/api/data/salesuk-*.json` (~75 snapshot files across 11 groups x 7 months)
- `Staff-requirements` repo: `.github/workflows/hourly-july-snapshot-refresh.yml`, all synced files

## Status
Live and verified. See `evidence/salesuk/2026-07-27_to-29_full-buildout-and-cleanup.md` for full detail.

## Outstanding
- Assign-from-UI persistence for the Not Assigned tab (needs a GitHub token or equivalent — deferred by the user).
- August not yet wired up.
- A handful of genuinely untraceable orders per month remain in Not Assigned (real Shopify data gaps, not rule misses).
