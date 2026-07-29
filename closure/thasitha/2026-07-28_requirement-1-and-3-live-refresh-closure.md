# Closure — Thasitha Req1 & Req3 Live PostgreSQL Refresh

**Date:** 2026-07-28 (built), 2026-07-29 (deploy gap found and fixed)

## Summary
Both Req1 and Req3 on `thasitha.html` were static, build-time-frozen snapshots with no refresh mechanism — Req3 (SKU Overlap & CPC Inflation) in particular had gone stale since 2026-07-15/16, still showing products removed from a campaign months earlier as "currently overlapping." Replaced both with live `/api/requirement?fn=thasitha-req1` / `fn=thasitha-req3` PostgreSQL endpoints (same pattern as Jefri's Req1), recomputing last-active-per-(product, campaign) and the active-vs-stale threshold on every request. Verified live: Req1 correctly picks up a 3rd Thasi campaign the old hardcoded list missed; Req3 correctly excludes a campaign last active 2026-03-04 while keeping June/July-active campaigns.

## Deploy gap found 2026-07-29
Same as SUK-R5 — committed to `aios-2` on 2026-07-28 but `Staff-requirements` (the repo this Vercel project's hourly cron deploys from) never received `pages/thasitha.html` or the updated `api/requirement.js`, so the live site was intermittently served without this work depending on which deploy source last fired. Fixed 2026-07-29 by syncing both files to `Staff-requirements` and redeploying manually.

## Linked files
- Evidence: `evidence/thasitha/2026-07-28_requirement-1-live-refresh-evidence.md`, `evidence/thasitha/2026-07-28_requirement-3-live-refresh-evidence.md`
- Validation: `validation/thasitha/2026-07-28_requirement-1-live-refresh-validation.md`, `validation/thasitha/2026-07-28_requirement-3-live-refresh-validation.md`
- Handover: `handover/thasitha/2026-07-28_requirement-1-live-refresh-handover.md`, `handover/thasitha/2026-07-28_requirement-3-live-refresh-handover.md`
- Commits: `61a8ed8` (Req1), `ffb5cba` (Req3)

## Status: PASS — live and verified in production (confirmed 2026-07-29, after fixing the sync gap)
**Reviewer:** Not recorded.
**Next step:** None outstanding.
