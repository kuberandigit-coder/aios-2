# Deployment Notes — sales25.js/sales25.html: 2025 Full-Year Backfill

**Project:** `digital-marketing-member-pages` (Vercel, org `digitalmarketing69140951-sys-projects`)
**Production URL:** https://digital-marketing-member-pages.vercel.app

**Deploys this task (chronological):**
1. Code deploy after extending `SUPPORTED_MONTHS` in `api/sales25.js` — enabled live (slow-path) queries for 2025-07 through 2025-12 before any snapshots existed.
2. Snapshot-bake deploy — after generating all 42 snapshot JSON files (`api/data/sales25-*-2025-{07..12}.json`) via `scripts/bulk-sales25-refresh.js`, redeployed so the static-snapshot fast path served them instead of live Shopify queries. This second deploy was necessary — without it, requests for the new months (verified specifically for November) fell through to the slow live-query path even though the files existed locally, because they weren't in the deployed bundle yet.

**Function count:** unchanged — no new API functions added, only whitelist/data changes to an existing function (`api/sales25.js`).

**Rollback:** standard `vercel rollback` if needed; no schema/DB changes were made (snapshot files are static, read-only artifacts).
