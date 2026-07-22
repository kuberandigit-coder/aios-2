---
title: Thasitha Sales Tab — May/June Snapshots Still Outstanding
date: 2026-07-22
type: open-item
status: PENDING
---

# Summary

Thasitha's standalone tab on the LEDSone staff sales dashboard (`reports/digital-marketing-member-pages/pages/sales.html`) was built on 2026-07-21 (`docs/2026-07-21_sales-dashboard-mahima-jeffri-fr-thasitha.md`) with the `utm_term=thasi` attribution rule, Jan–Apr cached via static snapshots. That same doc explicitly flagged **"Thasitha May/June snapshot files"** under "Not Yet Done."

On 2026-07-22, the same static-snapshot speed fix was applied to three other staff sales tabs — Sajeepan (Mar-Jun + Jan/Feb), Sonya (Jan-Jun upfront), and Theekshy (Mar-Jun) — via commits `d048167` and `a50643e`. No commit on 2026-07-22 (or since) added Thasitha's missing May/June snapshots.

## Current state
- Thasitha's sales tab is live and functional for Jan–Apr (snapshotted/fast) and May/June (works, but uncached — first load per month pulls live data and will be slower than the snapshotted months, same class of issue the 07-22 work fixed for Sajeepan/Sonya/Theekshy).
- This is a genuine, still-open gap — not resolved by any later commit as of 2026-07-22.

## Evidence
`evidence/sales/2026-07-22_thasitha-sales-tab-mayjun-snapshots-outstanding.md`

## Status: PENDING (no code changed, no fix implemented)
**Reviewer:** Flagged during 2026-07-22 AIOS documentation-gap review; not yet assigned.
**Next step:** Generate May/June static snapshots for Thasitha's tab using the same `generate-snapshots.js` tooling (now at `api/scripts/generate-snapshots.js` per commit `d64d3bb`) used for the other three staff on 2026-07-22, then re-cache the tab the same way.
