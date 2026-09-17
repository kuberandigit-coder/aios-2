# Handover — Dilaksi Task 08 Implementation (Broken Link / 404 Monitor)

Date: 2026-09-17

## What was built

A new Development Task, "Broken Link / 404 Monitor", in dm-dashboard
(`C:\Users\PC\Desktop\dm-dashboard`, branch `dev-work`, commit
`61bef03`, **not pushed**). Runs a controlled, bounded Screaming Frog
CLI list-mode crawl of ledsone.co.uk, detects broken links, enriches
each with real GA4/GSC/Shopify data, suggests a redirect only with real
evidence, assigns a priority, and presents it as a reviewable backlog
with Review Status and Development Status workflow columns. Never
auto-publishes a redirect or writes to Shopify.

## Where everything lives

- Backend: `backend/app/dev_tasks/broken_link_monitor/` (`__init__.py`,
  `screaming_frog.py`, `schema.py`, `enrich.py`, `router.py`), wired
  into `backend/app/dev_tasks/__init__.py`.
- Frontend: `frontend/src/admin/pages/dev-tasks/BrokenLinkMonitor.jsx`,
  wired into `AdminLayout.jsx`, `DevLayout.jsx`, `taskRegistry.js`.
- Database: `public.broken_link_monitor_crawls`,
  `public.broken_link_monitor_issues` (production Postgres).
- API: `/api/dev/broken-link-monitor/{crawl, crawl-status,
  crawl-history, summary, broken-links, broken-links/{id},
  broken-links/{id}/review, broken-links/{id}/status, statuses}`.

## What is genuinely NOT done yet (do not claim otherwise)

1. **No automated crawl scheduling** — "Next Scheduled Crawl" is
   tracked in the data model/UI but always shows "Not yet scheduled —
   manual trigger only." Wiring an actual cron/scheduled job was
   explicitly out of scope for this pass (per the governing spec's Step
   15) — it needs its own explicit sign-off before being added, same as
   a full-site crawl mode would.
2. **No full-site crawl mode** — by design. Every crawl is a small,
   explicit, bounded list-mode crawl (max 25 URLs per request, default
   test list is just the homepage + `/collections/all`). A genuine
   sitemap-seeded, unbounded crawl needs explicit sign-off, a Screaming
   Frog licence-tier check (free tier caps at 500 URLs/crawl), and
   almost certainly a longer-running job design (this one uses a
   300-second subprocess timeout) before it would be safe to add.
3. **No browser click-through test was performed** — the UI was built
   to spec and confirmed to compile/build cleanly, but nobody has
   actually clicked "Run Crawl" in a real browser against the running
   app yet. The very first real click-through should be treated as the
   first real test of the UI layer, not a formality.
4. **No live UAM grant/revoke test with an actual Dilaksi login** — the
   grant-gating mechanism is code-identical to every other `tools.Dev*`
   task and was verified by inspection, not by logging in as Dilaksi and
   confirming visibility.
5. **Redirect suggestion logic is deliberately conservative (v1)** — it
   only checks one concrete signal (a trailing `-<digits>` suffix
   difference against the live Shopify catalogue). A real fuzzy
   title-similarity/canonical-relationship engine does not exist in this
   codebase and was not built here — anything beyond that one signal
   correctly returns "No redirect suggestion" rather than guessing.

## Recommended next steps (for whoever picks this up)

1. Start the dev server, log in, click through the new sidebar item as
   Dilaksi (or a user granted `tools.DevBrokenLinkMonitor`), click "Run
   Crawl", and confirm the UI actually reflects a real crawl end to end.
2. Test the UAM grant/revoke flow for `tools.DevBrokenLinkMonitor`
   specifically via `UserAccessManagement.jsx`.
3. Decide, with explicit user sign-off, whether/when to attempt a larger
   (but still bounded) crawl — e.g. seeded from the actual sitemap with
   a real upper limit — rather than the current small hand-picked test
   list.
4. If a genuine "next scheduled crawl" cadence is wanted, use the
   existing `ScheduledSnapshot` pattern (see `scheduled_snapshot.py`) as
   the reuse target, consistent with this task's own "reuse, don't
   rebuild" instruction.

## Deployment status

**Not deployed to production.** Code is committed locally on the
`dev-work` branch only, not pushed to any remote, and no Vercel/server
deployment was performed as part of this task.
