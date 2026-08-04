# Sales Dashboards — August 2026 Month Rollover (Handover)

**Date:** 2026-08-04
**Team:** Digital Marketing (DE: Mahima, Jeffri, Sukirtha, Thasitha; UK: 14 groups + Jackson)

## What was done

August 2026 added as the live month, July 2026 closed out with static snapshots, across
all 2026 Shopify-sales dashboards: DE (`sales2.html` — Mahima, Jeffri, Sukirtha, Thasitha
sections), UK (`salesuk.html` — all 14 groups), and Jackson (`jackson-sales.html`, found
via a follow-up sweep). 2025 pages were explicitly left alone.

## What's next — this repeats every month

This was a **manual** process, not automation. At the start of every future month, the same
steps need repeating:
1. Update `SUPPORTED_MONTHS`/`CURRENT_LIVE_MONTHS` in `api/sales.js` (5 blocks) and
   `api/salesuk.js` (1 block).
2. Add the new month's tab to each affected page, demote the previous month's tab label.
3. Update each section's `*_LIVE_MONTHS`/`*_CURRENT_MONTH` JS defaults.
4. Generate the just-closed month's static snapshots (DE: 7 endpoints; UK: 14 groups +
   Jackson).
5. Deploy, verify, commit, sync to both repos.

**A scoped automation option was proposed to the user** (a manual "Start New Month" trigger
that would do steps 1–4 on click, with deploy either automatic via a stored deploy hook or
left as a manual final step) — **the user chose to defer this for now**. If asked again,
this design is already scoped and ready to build.

## Where to find things

- Evidence: `evidence/sales/2026-08-04_august-2026-month-rollover-evidence.md`
- Validation: `validation/sales/2026-08-04_august-2026-month-rollover-validation.md`
- Report: `reports/sales/2026-08-04_august-2026-month-rollover-report.md`

## Risks / open questions

- FR sections (Hetheesha, Thivagini) on `sales2.html` still show July as live — will need
  the same fix whenever FR is back in scope.
- If this manual process is forgotten at the start of a future month, the live month will
  silently stay stuck (same symptom as the original DE/UK complaint that triggered this
  whole fix) — worth a recurring reminder/checklist item.
