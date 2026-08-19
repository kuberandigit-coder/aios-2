## Purpose
Extend the perf-batch loading-speed fix (see [[2026-08-19_sonya-perf-batch-endpoint]]) to Sajeepan's tab on muguntha.html's Employee Performance page, per Kuberan's request ("ok now do the same fix for sajeepan only for now").

## Change
1. `api/muguntha.js`: generalized the Sonya-only `handlePerfBatch()` into a `PERF_BATCH_MEMBERS = new Set(['sonya', 'sajeepan'])` allow-list; the batch logic itself was already member-agnostic (used `member` as the Shopify `group` param and the `getCostPayload` employee key), so no per-member special-casing was needed beyond adding 'sajeepan' to the set.
2. `pages/muguntha.html`: generalized `fetchSonyaBatch()` into `fetchPerfBatch(member, force)`, driven by the same `PERF_BATCH_MEMBERS` set on the client; `loadAll()` now uses the batch path for any member in that set (currently Sonya + Sajeepan), original 40-request path unchanged for Kamsi/Jefri/Dilaksi.

## Files changed
- `reports/digital-marketing-member-pages/api/muguntha.js`
- `reports/digital-marketing-member-pages/pages/muguntha.html`

## Evidence
- Syntax-checked both files (`node -e "require(...)"` for muguntha.js, inline `<script>` blocks via `new Function()` for muguntha.html) — no errors.
- `vercel.json`'s `api/muguntha.js` maxDuration was already raised to 300 in the Sonya fix, so no separate timeout fix needed here — Sajeepan's batch reuses the same function budget.
- Deployed to production (deployment dpl_7YT9mjRzMGW3A3R4kapCPZz1Hovj, READY, aliased to https://dm-dashboard.vintageinterior.co.uk).
- Pushed to both repos: Staff-requirements (commit e98e245), aios-2 (commit 0b3411a).

## Status
PASS — deployed live. Not yet manually re-confirmed by Kuberan in the browser (Sonya's equivalent fix was confirmed manually; Sajeepan's has not been explicitly re-checked yet at time of writing).

## Reviewer
Kuberan

## Next step
Confirm Sajeepan's tab loads fast in the live UI. Extend to Kamsi/Jefri/Dilaksi if wanted.
