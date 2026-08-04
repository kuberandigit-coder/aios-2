# Sales Dashboards — August 2026 Month Rollover

**Date:** 2026-08-04
**Team:** Digital Marketing (DE: Mahima, Jeffri, Sukirtha, Thasitha; UK: 14 groups + Jackson)

## Purpose

Roll August 2026 in as the new "live" month and close out July 2026 as a historical,
snapshotted month, across every 2026 Shopify-sales dashboard — without touching the
separate 2025 pages (`2025DE.html`, `sales25.html`), per explicit user instruction.

## Requirement source

Direct user request, 2026-08-04, referencing an earlier (undelivered) expectation that
month rollover would be automatic.

## Business question

Why isn't August data showing on the dashboards, and can it be fixed for everyone on 2026
data?

## Work completed

### DE (`api/sales.js`, `pages/sales2.html`)
- Updated all 5 `SUPPORTED_MONTHS`/`CURRENT_LIVE_MONTHS` blocks in `api/sales.js` (one per
  handler module) to include `2026-08` and mark it as the live month (July demoted).
- Updated 6 sections in `pages/sales2.html` (Mahima Organic, Mahima Ads-Term, Jeffri,
  Thasitha, Sukirtha Organic, Sukirtha Email — the DE-scoped sections; Hetheesha/Thivagini
  FR sections were left untouched, out of scope): added an August tab, demoted July's tab
  label from "July (live)" to "July", updated each section's `*_LIVE_MONTHS` and
  `*_CURRENT_MONTH` JS defaults.
- Generated July 2026 static snapshots for all 7 affected DE endpoints (Mahima Organic,
  Mahima Ads-Term, Jeffri Ads, Jeffri Meta, Thasitha Ads, Sukirtha Organic, Sukirtha Email).

### UK (`api/salesuk.js`, `pages/salesuk.html`, `pages/jackson-sales.html`)
- Updated `SUPPORTED_MONTHS`/`CURRENT_LIVE_MONTHS` in `api/salesuk.js`.
- Added August tab to `salesuk.html`'s single shared month-tab bar (14 groups: DM-Ad, Meta,
  Sonya, Sajeepan, Sukirtha, Kamsi, Dilaksi, Direct, Organic, CPPC, Thishoban, Theekshy,
  Thanishtika, Not Assigned).
- Found and fixed `jackson-sales.html` (ledsone.co.uk, backed by the same `api/sales.js`
  file) with the same tab/live-month update — discovered via a repo-wide grep for "July
  (live)" after the initial DE+UK fix, confirming no other page was missed.
- July 2026 UK snapshots were already being kept current by the pre-existing hourly cron
  (since July was still the live month until this change), so no manual regeneration was
  needed for the 14 UK groups; Jackson's July snapshot was generated manually.

## Files created or modified

- `api/sales.js`, `pages/sales2.html`
- `api/salesuk.js`, `pages/salesuk.html`
- `pages/jackson-sales.html`
- `api/data/mahima-de-organic-sales-2026-07.json`, `mahima-de-ads-term-sales-2026-07.json`,
  `jeffri-de-ads-sales-2026-07.json`, `jeffri-meta-sales-2026-07.json`,
  `thasitha-de-ads-sales-2026-07.json`, `sukirtha-de-organic-sales-2026-07.json`,
  `sukirtha-de-email-sales-2026-07.json`, `jackson-sales-2026-07.json`

## PostgreSQL source checked

Not applicable — these are Shopify-Admin-API-backed sales dashboards, not Postgres-backed.

## Evidence

- Live endpoint tests confirmed August returns real live data (e.g. Mahima: 8 orders for
  2026-08 on first check).
- July snapshot files verified to parse and return `success:true` with plausible order
  counts (e.g. Jeffri Ads July: 228 orders; UK Sonya July: 693 orders).
- `cacheStatus: static-snapshot` confirmed on a post-deploy re-fetch of July data (fast path
  working, not falling through to a live query every time).

## Validation

See `validation/sales/2026-08-04_august-2026-month-rollover-validation.md`.

## Known limitations

- **This is not true automation.** Month tabs and live-month flags are still hardcoded
  arrays/HTML — this same manual process (add tab, flip live-month flag, generate prior
  month's snapshot, deploy) must be repeated at the start of every future month. The user
  was offered a scoped automation proposal (a "Start New Month" trigger) and chose to defer
  it for now (see `handover/sales/2026-08-04_august-2026-month-rollover-handover.md`).
- FR sections (Hetheesha, Thivagini) on `sales2.html` were intentionally left on July —
  out of scope per "de peoples"/"uk" framing of the request, not an oversight, but will
  need the same fix whenever FR is in scope.
- 2025 pages (`2025DE.html`, `sales25.html`) were explicitly not touched, per instruction.

## Next step

None outstanding for the requested scope. If FR sections need the same rollover, that's a
small follow-up (2 more sections in the same file, same pattern).

## PASS / FAIL

PASS
