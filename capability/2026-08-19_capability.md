# Capabilities — 2026-08-19

## Capability — In-Process Batch Aggregation Pattern (avoiding N real HTTP round-trips)

**Date:** 2026-08-19
**Owner:** Kuberan (Muguntha's dashboard, Sonya's performance data)
**Project:** digital-marketing-member-pages (`api/muguntha.js`)
**Status:** Implemented, verified live with no behaviour change to the existing single-month path

### Capability

Aggregate many months/periods of an existing per-period handler's data in a single serverless
invocation, by calling the existing handlers **in-process** via a mock `req`/`res` rather than
issuing real HTTP requests for each period — with a concurrency cap so the underlying data source
isn't hit all at once.

### Technical implementation

1. **Pure refactor first, verified no behaviour change.** The existing single-month cost handler
   was refactored into a standalone `getCostPayload(employeeKey, month, forceRefresh)` function
   before anything else was built on top of it — verified live (`?employee=sonya&month=2026-08`,
   HTTP 200, 2.7s, identical field shape to before).
2. **New batch route, additive only.** `handlePerfBatch()` behind `?action=perf-batch&member=sonya`
   fetches all 20 months of sales (in-process calls into `salesuk.js`/`sales25.js`'s existing
   handlers via a mock `req`/`res`, never a real HTTP round trip) and cost (direct
   `getCostPayload` calls), concurrency-capped at 6 via a server-side `mapLimit`.
3. **Opt-in only, zero risk to other staff.** The frontend only calls the new batch path when
   `member === 'sonya'`; every other staff member still uses the original per-request path,
   untouched.
4. **Found and fixed a real timeout bug caused by the new batch path**: the batch endpoint now
   runs a live-month Shopify scan in-process (documented as taking 30-90s+), which the existing
   60s `maxDuration` was silently killing before it could finish. Fixed by bumping
   `api/muguntha.js`'s `maxDuration` to 300 in `vercel.json`, matching the budget `salesuk.js`
   itself already used for the same underlying scan.

### Originating task

`evidence/muguntha/2026-08-19_sonya-perf-batch-endpoint.md`,
`validation/muguntha/2026-08-19_sonya-perf-batch-endpoint.md`

### Reuse

This in-process-call + concurrency-cap technique is reusable for any future "fetch N periods in
one request instead of N requests" need on this project's Vercel functions — and the specific
`maxDuration` gotcha (a new in-process call chain can silently exceed the OLD function's timeout
budget even though no single call changed) is worth checking for any future batch-aggregation
endpoint built the same way.
