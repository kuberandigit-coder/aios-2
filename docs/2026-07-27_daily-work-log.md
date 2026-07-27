# Daily Work Log — 2026-07-27

## Summary
Found UK Meta/Facebook orders for January, which led to discovering that the main sales dashboard's per-staff UK tabs (Kamsi/Dilaksi/Sajeepan/Sonya/DM) can double-count the same order (48% of January orders appear in 2+ tabs). Built a new Meta UK tab on the existing dashboard, then built a brand-new standalone page (`salesuk.html` / `api/salesuk.js`) with mutually-exclusive order groups, starting with January's DM-Ad and Meta groups.

## Tasks Completed
1. **Meta UK tab** on `sales.html` — orders classified Social (Facebook/Instagram/Pinterest/TikTok) not already claimed by other Ads tabs.
2. **Paid-search gap / social / first-session-split audits** added to `api/sales.js`'s debug endpoint — tools for finding unclaimed campaigns and reviewing every order in a month bucket-by-bucket.
3. **Cross-tab order overlap discovery** — direct order-name-set comparison across 6 UK tabs' January data, found 1,037/2,156 (48%) orders counted more than once.
4. **New standalone page `salesuk.html` + `api/salesuk.js`** — deliberately separate from the main dashboard backend. January tab → DM-Ad group (962 orders / £23,092.53 net) and Meta group (342 orders / £6,198.41 net), both mutually exclusive by construction (priority-ordered `GROUPS`, first match wins), order-level rows with full session history.
5. **Performance fix** for the new page — GraphQL page size 50→100 plus a static-snapshot fast path (same pattern as the rest of the dashboard), cutting cold loads from timing out to ~2s.
6. **EOD / Blog tool folders removed** from the `aios-2` repo (nested git repos, relocated elsewhere on the user's system per their instruction).
7. **Sonya total January order-count question, Sajeepan/DM/Sonya order-count table (Jan-Jul)** answered directly from dashboard snapshot data.

## Files Touched
- `reports/digital-marketing-member-pages/api/sales.js`
- `reports/digital-marketing-member-pages/pages/sales.html`
- `reports/digital-marketing-member-pages/api/salesuk.js` (new)
- `reports/digital-marketing-member-pages/pages/salesuk.html` (new)
- `reports/digital-marketing-member-pages/home.html`
- `reports/digital-marketing-member-pages/vercel.json`
- `reports/digital-marketing-member-pages/api/data/salesuk-dm-ad-2026-01.json`, `salesuk-meta-2026-01.json` (new)

## Status
All deployed live via `vercel --prod`. See linked evidence/validation/closure docs for full detail:
- `evidence/digital-marketing-member-pages/2026-07-27_meta-uk-tab-and-order-overlap-discovery.md`
- `evidence/salesuk/2026-07-27_standalone-order-level-page.md`

## Outstanding
- Meta UK tab (on the main `sales.html`) has no static snapshot yet — still a live-fetch, slow cold load.
- `salesuk.html` only covers January so far; Feb-Jul not built.
- Remaining first-session groups from the January split (Direct, Organic Search, Referral, Email, No Journey Data) still need owner assignment before further group tabs can be added.
