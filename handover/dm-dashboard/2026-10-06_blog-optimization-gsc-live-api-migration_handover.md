# Handover — Blog Optimization: GSC live API migration + applied-fix persistence

Date: 2026-10-06
Owner: (dm-dashboard dev tooling)
Reviewer: Kuberan

## What was done

1. Moved Blog Optimization's GSC data off the external business database onto this app's own
   Postgres, synced weekly by a live Google Search Console API call — only for the 3 sites
   confirmed to actually have live API access (`ledsone.co.uk`, `ledsone.de` via the shared
   service account, `ledsone.fr` via its own dedicated account). The other 5 sites previously
   listed are not reachable with this app's own GSC credentials (HTTP 403) — re-adding one
   requires that property's access granted to one of these two service accounts inside Search
   Console itself, not a code change.
2. Connected Shopify content lookup (Current Blog HTML, QA Check, Fix/Apply) for `ledsone.de`
   and `ledsone.fr`, previously hardcoded to `ledsone.co.uk` only.
3. Two UI fixes on the detail page (sticky quick-nav behavior, Current Blog HTML default tab).
4. Applied fixes now persist across reloads, with a new "Locate Changes" button, a "Changed"
   button for manually-handled QA items, and a "View Changes" button on the Completed tab.

## Files changed

- `backend/app/dev_tasks/blog_optimization/gsc_sync.py` (new) — live GSC fetch + upsert
- `backend/app/dev_tasks/blog_optimization/scheduler.py` (new) — weekly `ScheduledSnapshot`
- `backend/app/dev_tasks/blog_optimization/gsc.py` — reads now go through the app's own DB
- `backend/app/dev_tasks/blog_optimization/schema.py` — 3 new tables (`blog_optimization_gsc_page`,
  `blog_optimization_gsc_query`, `blog_optimization_fix_log`)
- `backend/app/dev_tasks/blog_optimization/shopify.py` — store-aware content resolver (UK/DE/FR)
- `backend/app/dev_tasks/blog_optimization/router.py` — new fix-log + manual-change endpoints
- `backend/app/dev_tasks/__init__.py` — scheduler registration
- `frontend/src/admin/pages/SalesSyncMonitor.jsx`, `frontend/src/dev/DevLayout.jsx` — Sync
  Monitor sidebar entry
- `frontend/src/admin/pages/dev-tasks/BlogOptimization.jsx`, `frontend/src/styles/dashboard.css`
  — sticky nav fix, preview default, fix-log hydration, Locate Changes, Completed tab button

## Testing

Live-tested against the real production database and real external APIs at every step, not
just compiled/built:
- Live GSC access confirmed per-site before building anything.
- Zero-rows bug confirmed via the scheduler's own stored error payload, then a real
  301,175-page-row / 75,606-query-row sync after the fix.
- Sidebar bug confirmed by `curl`-inspecting the deployed production CSS/JS bundles directly
  before concluding it was a code gap, not a stale deploy.
- `shopify.py`: ledsone.fr tested against a real article end-to-end; ledsone.de's exact
  `ACCESS_DENIED` error captured and reported rather than silently left broken.
- Fix-log table: live round-trip save/read test against the real database.

## Current status

**Implemented and live** (pushed to `dev-work`, merged to `main` via Dev Tools through the
day — commits `25fc4d1`, `748add9`, `abe12f7`, `87c86bc`, `4a331ff`, `5c1d15f`, `400360c`,
`617e690`).

## Known limitations

- **ledsone.de content features blocked on a Shopify admin permissions grant.** The Shopify
  app behind `SHOPIFY_ADMIN_TOKEN` (the `ledsone_de` store) is missing the `read_content`
  access scope. Until Kuberan grants that scope to the DE app in Shopify admin, DE's GSC
  metrics work but Current Blog HTML / QA Check / Fix / Apply return "DATA NOT AVAILABLE" for
  that site — correct, non-fabricated behavior, not a bug.
- **5 sites remain unsupported** for Blog Optimization entirely (`ledsone.us`, `dcvoltage.co.uk`,
  `vintagelite.co.uk`, `electricalsone.co.uk`, `besbet.co.uk`) until their GSC property access
  is granted to one of the two service accounts this app uses.
- **"Locate Changes" not yet manually click-tested in the browser** by a second person — the
  underlying logic was validated by code review and a live data round-trip, but the actual
  click-through-and-see-it-highlight experience hasn't been independently confirmed.

## Next step

- Grant `read_content` scope to the DE Shopify app, then re-test `ledsone.de` content features.
- Get GSC property access granted (in Search Console) for any of the 5 unsupported sites that
  still matter for this task, if desired.
- Click through "Locate Changes" and the Completed tab's "View Changes" live once deployed, to
  close out the one pending manual verification step.
