## Purpose
Deploy Jefri Req 7 (B&Q -> Amazon -> Shopify SKU & Price Reconciliation, built in a separate Kuberan Claude session, commit 9689fe6 on aios-2) to production, per Kuberan's request "deploy jeef req 7".

## Pre-deploy review
Before deploying, ran `/ultrareview` against main. It surfaced 4 distinct findings in this commit's code:
1. **Real bug** — `staff-id-performance.html` line 1 had stray text `"i mean m"` before `<!DOCTYPE html>`. Investigated: this only existed as an *uncommitted local change* in the aios-2 working directory — the Staff-requirements worktree (what actually deploys) never had it, so production was never broken by it. Fixed anyway (removed the stray text) so it can't accidentally get committed later.
2. **Real bug** — `handleJefriReq7` in `api/requirement.js` called `client.release()` explicitly on 3 early-return paths inside the `try` block, but the `finally` block already calls `client.release()` unconditionally on every exit path (including those same early returns) — pg throws on double-release. Fixed by removing the 3 explicit calls, leaving only the `finally` release.
3. **Real bug** — `amazonBySku`/`shopifyBySku` maps in the same handler pushed each listing row under both `r.sku` and `r.mapped_sku` with no dedupe check — when `mapped_sku === sku` (i.e. no actual remapping), the same row got pushed into the same array twice, double-counting that listing in price comparisons. Fixed by only pushing under `mapped_sku` when it differs from `sku`.
4. **False positive** — flagged `r7Init()` (called at jefri.html:886) as "never defined". Verified: it IS defined at jefri.html:1864 (`function r7Init(){`), just in a later `<script>` tag. Since these are plain sequential inline scripts (not modules), top-level function declarations share the global scope, and the call only fires on tab-click — long after all scripts have executed. No fix needed.

Two other findings from the review (`bug_002` date-timezone-shift, `bug_003` rounding-drift) were refuted by the review's own verification pass — not acted on.

## Fix
- `reports/digital-marketing-member-pages/api/requirement.js`: removed 3 redundant `client.release()` calls; added `&& r.mapped_sku !== r.sku` guard to both `amazonBySku`/`shopifyBySku` population loops.
- `reports/digital-marketing-member-pages/pages/staff-id-performance.html`: removed stray "i mean m" text before DOCTYPE (was uncommitted-local-only, never live).

## Evidence
- Syntax-checked `requirement.js` (`node -e "require(...)"`) — loads cleanly.
- Confirmed `staff-id-performance.html` starts with clean `<!DOCTYPE html>` after fix.
- Deployed to production (deployment dpl_9jsD9rU2PWvfbcLjSEjGoS3rGntq, READY).
- Live-tested `GET /api/requirement?fn=jefri-req7` — HTTP 200 in 2.0s, returned real reconciliation data (2 rows for 2026-08-19, with amazonFlag/shopifyFlag values populated correctly).
- Pushed to both repos: Staff-requirements (commit 6b49bbf — this also brought the entire Req7 feature into Staff-requirements for the first time, since it previously only existed on aios-2), aios-2 (commit c973932).

## Status
PASS — deployed and live-verified via direct API call. Full jefri.html Req7 tab UI not browser-tested (no visual/click-through confirmation yet).

## Reviewer
Kuberan

## Next step
Kuberan or the other session to confirm the Req7 tab renders correctly in the browser (nav link, filters, KPI cards, table, export button) — this evidence only confirms the API layer.
