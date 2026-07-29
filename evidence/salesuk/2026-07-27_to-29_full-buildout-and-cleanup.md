# Evidence — salesuk.html Full Buildout (Jan-Jul, 11 groups), sales.html Cleanup

**Date range:** 2026-07-27 to 2026-07-29
**Commits:** ~100 commits on `reports/digital-marketing-member-pages/{api/salesuk.js,pages/salesuk.html,pages/sales.html,api/sales.js,api/scripts/generate-snapshots.js,home.html}` — see `git log --oneline -- reports/digital-marketing-member-pages` for the full list; too many individual snapshot-regen commits to enumerate here.

## Purpose
Continuation of the salesuk.html build (see `evidence/salesuk/2026-07-27_standalone-order-level-page.md` for the initial January-only, 2-group version). This covers everything since: full historical backfill, group discovery/expansion, a restructure, diagnostic tooling, going live for July, and finally retiring the superseded tabs on the main dashboard.

## What Was Done

### 1. Structural restructure
Flipped the page from Month-as-main-tab/Group-as-sub-tab to **Group-as-main-tab/Month-as-sub-tab** (per user request) — 11 groups now sit at the top, each with Jan-Jul month sub-tabs. Fixed a latent cache-key bug in the process (was keyed by group only, silently reused stale data across months once more than one month existed).

### 2. Group discovery and expansion (11 groups total)
Starting from DM-Ad + Meta (Jan only), grew via repeated "find the gap, ask the user who owns it" cycles into: **DM-Ad, Meta, Sonya, Sajeepan, Sukirtha, Organic, CPPC, Thishoban, Theekshy, Thanishtika, Not Assigned**. Each group is matched by a priority-ordered rule in a `GROUPS` array — first match wins, guaranteeing no order is ever double-counted (the exact problem that motivated this whole page). Key matching techniques developed along the way:
- **Second-session / last-session lookthrough**: when an order's first session carries no campaign/term, check later sessions in the same customer journey for a known campaign before giving up.
- **Permanent vs month-scoped rules**: some patterns (e.g. `sag_organic` → DM-Ad) apply to all months; one (Sonya's untraceable-`medium=google_ads` catch-all) started Feb-only, was extended month-by-month as it proved correct, and is now a permanent all-months rule per explicit user confirmation (2026-07-28).
- **Two real bugs found and fixed**: (a) `matchValue()` wasn't receiving `journey`, mislabeling every group's rows as "No Journey Data"; (b) a Shopify quirk where a genuine Google-organic click can carry `utm_campaign="Multifeeds"` (free Shopping listing tag) caused a mislabeled bucket — fixed by prioritizing actual `source` over `utm_campaign` for organic-search display.

### 3. Backfilled Jan-Jun for all groups, went live for July
Every group's snapshot generated for all 6 closed months via `scripts/bulk-salesuk-refresh.js` (sequential, 15s cooldowns, retries on Shopify throttling). July added as the live month-to-date (mirrors `sales.html`'s July convention) — wired into the existing hourly GitHub Actions workflow via a new `salesuk` mode in `api/scripts/generate-snapshots.js`, so all 11 groups refresh automatically every hour going forward.

### 4. "Not Assigned" tab (the 11th group)
A virtual group — not part of `GROUPS`, computed as "whatever no real group claimed." Same order-level UI as every other tab, live-updated for July. Ensures no order can ever silently vanish: it's either in a named group or in Not Assigned, never neither. Manual promotion from Not Assigned into a real group is still a deliberate human-in-the-loop step (deferred building an in-browser Assign UI + persistence, since Vercel functions have no writable persistent storage without a GitHub token the user hasn't set up yet).

### 5. Diagnostic infrastructure (`?group=remaining`)
Built out incrementally into a real investigation tool: per-order `orderNames`, `terms` (every session, not just first), `mediums`, `sessionCounts`, `lastSessionCampaigns`, and per-order `orderDetails` — used throughout to distinguish "genuinely untraceable" (no campaign anywhere in the whole journey) from "traceable via a later session" before assigning anything, per the user's explicit "do not overlap, verify before assigning" instruction.

### 6. Retired the superseded tabs on sales.html (2026-07-28/29)
Once salesuk.html covered the same ground without the double-counting problem, the user had the 5 old per-staff tabs (Sajeepan, Theekshy, Sonya, DM, Meta·UK) and Sukirtha's UK sub-tab permanently removed from `sales.html` — nav buttons, HTML content blocks, and JS sections all deleted (~450 lines of HTML/JS). A day later, the now-unreachable backend handlers for those same 5 staff keys were removed from `api/sales.js` too (~405 lines) — confirmed dead (zero remaining references) before deletion. `sales.html` gained a "UK Sales" nav tab pointing to `salesuk.html`; `salesuk.html`'s own "Back to Dashboard" link was removed (redundant with the new nav path). `home.html`'s "Sales UK" quick-link button was removed and Sukirtha's dashboard-card report count corrected to 5.

## Operational discovery: dual-deploy hazard
Mid-session, `api/salesuk.js` vanished from production without any code change on my part. Root cause: the Vercel project is git-linked to a **second** GitHub repo (`Staff-requirements`), which has its own hourly cron (GitHub Action) that auto-deploys from its own `main` branch — and `salesuk.js` had only ever been pushed to `aios-2`, never synced to `Staff-requirements`. The hourly cron's deploy silently overwrote my manual `vercel --prod` deploy. Fixed by syncing every salesuk-related file (code, snapshots, workflow) to `Staff-requirements` via a `git worktree`, repeated after every subsequent change for the rest of the session. This is now a standing requirement for any future work on this Vercel project: **both repos must be kept in sync, or the hourly cron will revert changes within the hour.**

## Files Changed (representative, not exhaustive)
- `reports/digital-marketing-member-pages/api/salesuk.js` (new file, grew to ~830 lines)
- `reports/digital-marketing-member-pages/pages/salesuk.html` (new file)
- `reports/digital-marketing-member-pages/pages/sales.html` (5 tabs + Sukirtha UK sub-tab removed, UK Sales nav added)
- `reports/digital-marketing-member-pages/api/sales.js` (5 dead handler blocks removed, ~405 lines)
- `reports/digital-marketing-member-pages/api/scripts/generate-snapshots.js` (`salesuk` mode added)
- `reports/digital-marketing-member-pages/scripts/bulk-salesuk-refresh.js` (new file)
- `reports/digital-marketing-member-pages/home.html` (Sales UK button removed, Sukirtha count corrected)
- `reports/digital-marketing-member-pages/api/data/salesuk-*.json` (11 groups x 7 months = ~75 snapshot files)
- `Staff-requirements` repo: `.github/workflows/hourly-july-snapshot-refresh.yml` (`salesuk` step added), all of the above files synced repeatedly

## Status
Live and verified. January-June fully assigned (0-1 orders remaining per month, all confirmed genuinely untraceable). July live and auto-refreshing hourly, currently 2 untraceable orders in Not Assigned.

## PASS/FAIL
PASS — every group live-verified with real order counts/net sales at each step; mutual exclusivity guaranteed by code construction (priority-ordered array, first match wins), not just by convention.

## Next Step
Build the Assign-from-UI persistence for the Not Assigned tab (needs a GitHub token as a Vercel env var — deferred by the user, 2026-07-28). Extend salesuk.html to August once that month opens. Continue triaging genuinely-untraceable orders manually as new patterns appear.
