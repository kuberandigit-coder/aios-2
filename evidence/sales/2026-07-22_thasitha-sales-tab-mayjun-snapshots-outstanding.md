# Evidence — Thasitha Sales Tab May/June Snapshots Outstanding

**Date logged:** 2026-07-22
**Status:** PENDING / open item, no fix implemented

## Source of the gap
`docs/2026-07-21_sales-dashboard-mahima-jeffri-fr-thasitha.md`, "Not Yet Done" section, line 22:
> "Thasitha May/June snapshot files."

## What happened since
Git history from 2026-07-21 to 2026-07-22 was checked (`git log --since="2026-07-21"`) for any commit touching Thasitha's sales-tab snapshots. Found:

```
2026-07-22 d64d3bb refactor: move generate-snapshots.js to api/scripts/, excluded from Vercel deploy
2026-07-22 8d5028c feat: Sonya new UK Ads tab, Jan-Jun snapshotted upfront
2026-07-22 d048167 perf: static snapshots for Sajeepan Mar-Jun and Theekshy Mar-Jun (tab speed fix)
2026-07-22 a50643e feat: Theekshy new UK Ads tab + permanent snapshot tooling + Sajeepan Jan/Feb snapshots
```

None of these four commits reference Thasitha. The snapshot-speed fix was applied to Sajeepan, Sonya, and Theekshy on 2026-07-22 but not to Thasitha, even though her tab had the identical outstanding item logged the day before.

## Impact
Thasitha's sales tab remains live and correct for all months, but May/June specifically will load slower (live query, not snapshotted) than Jan–Apr and than the other three staff's now-snapshotted tabs — same class of performance issue already fixed elsewhere on the dashboard.

## Recommended fix (not yet performed)
Run the snapshot generator (`api/scripts/generate-snapshots.js`, moved there in commit `d64d3bb`) for Thasitha's `utm_term=thasi` query, May and June 2026, and wire the resulting static files into her tab the same way Jan–Apr already are.

**Reviewer:** Not yet assigned.
**Next step:** See `docs/2026-07-22_thasitha-sales-tab-mayjun-snapshots-outstanding.md`.
