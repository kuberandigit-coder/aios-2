# Validation — Mahima Req3 Search Terms Report Goes Live, Then Relocated

**Date:** 2026-07-23

## Checks
- [x] Live SQL query confirmed runnable against production Postgres before building the endpoint (ran the exact UNION/JOIN query via `mcp__ledsone-db-mcp__execute_sql`, returned real rows for account 9031058245).
- [x] Classification logic (Query Intent / Recommended Action / Priority / Trend) verified against the original Python builder's word lists and rules — ported 1:1, not re-derived from scratch.
- [x] Live endpoint deployed to Vercel prod and hit directly: returned `summary.totalTerms: 59918`, `keepCount: 95`, `excludeCount: 59823`.
- [x] `sales.html` grep-verified to have zero remaining `Search Terms`/`mSubSearchTerms`/`mstLoad` references after relocation — clean removal, not a partial/broken leftover.
- [x] `mahima.html` Tab 3 grep-verified post-deploy to contain `r3refreshBtn`/`r3Reload`/`fn=mahima-search-terms` — the live wiring is actually present in the deployed page, not just in the local diff.
- [x] Both HTML files' `<script>` blocks passed a `new Function()` syntax check before and after every edit (large-file edits carry real risk of unbalanced braces/quotes given `mahima.html`'s ~4.2MB embedded data line).
- [x] Field-mapping from API response (`searchTerm`/`campaign`/`matchType`/etc.) to the pre-existing `mahima.html` row shape (`st`/`c`/`mt`/etc.) confirmed correct by re-reading `rowHtml3()`/`updateKpis3()` before writing the mapping — no guessed field names.

## Status: PASS (live-tested end-to-end by the same session that built it)
**Reviewer:** Not recorded (user directed the relocation after reviewing the initial `sales.html` placement).
**Next step:** None outstanding. If Mahima's "existing negative keyword" (`nk`) data ever becomes available from a real source, it currently defaults to `"No"` in the live path (the original static report also always showed "No" — not a regression).
