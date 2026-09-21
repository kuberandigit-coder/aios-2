# Validation — Collection Page Thin-Content Detector, Level 1

Date: 2026-09-21

| # | Test | Result | Notes |
|---|------|--------|-------|
| T01 | Shopify collection retrieval works | PASS | 490 real collections fetched live |
| T02 | Pagination handles all collections | PASS | `hasNextPage`/`endCursor` loop, confirmed 490 (>100, so pagination exercised) |
| T03 | Collection URL generation correct | PASS | `https://ledsone.co.uk/collections/<handle>` matches live site pattern used elsewhere in codebase |
| T04 | HTML-stripped word count correct | PASS | BeautifulSoup strip + get_text, verified on real descriptions (e.g. Seguno collection text) |
| T05 | Empty/null description handled | PASS | Returns wordCount 0, no crash, never fabricated |
| T06 | Threshold discovery attempted before invention | PASS | Documented exhaustive search; none found; NULL by default |
| T07 | Threshold never silently invented | PASS | `priority_rules.compute_priority` returns `NOT CONFIGURED` when `min_word_count is None` |
| T08 | UI shows Word Count / Threshold / Below Threshold | PASS | Table + detail modal show all three, "Not Configured" state included |
| T09 | FAQ content vs FAQ schema distinguished | PASS | Two independent booleans (`has_faq_content`, `has_faq_schema`), separate regex vs JSON-LD check |
| T10 | FAQ schema never fabricated | PASS | Only matches literal `"@type":"FAQPage"` JSON-LD string, no guessing |
| T11 | GSC retrieval uses existing integration | PASS | Reuses `google_client.query_gsc`, no second auth system |
| T12 | GSC URL matching handles trailing slash/protocol | PASS | `_match_path()` normalizes both sides before compare |
| T13 | Missing GSC data represented explicitly | PASS | `gsc_clicks` etc. are `None` (`"no available GSC data"`), not fabricated zero |
| T14 | Priority rules deterministic, no AI | PASS | Fixed if/else table in `priority_rules.py`, no LLM call |
| T15 | Priority reason strings match spec format | PASS | e.g. "Thin content on high-traffic collection." |
| T16 | Traffic threshold never invented | PASS | Same NULL-by-default/"Unknown" pattern as word-count threshold |
| T17 | Backlog reuses existing status system | PASS | `'New'/'Review Required'/'Approved'/'Rejected'` copied from `internal_linking_suggestions` |
| T18 | Filters work (Priority/FAQ/Content/Traffic/Search) | PASS | Verified in frontend `filtered` memo logic; not click-tested in a live browser this session |
| T19 | Detail view shows all required fields | PASS | All Section 11 detail fields present in `DetailModal` |
| T20 | Refresh is non-blocking | PASS | `BackgroundJob` pattern, same as `internal_linking`; live run took several seconds live via poll |
| T21 | No Shopify write operation exists anywhere | PASS | `content_fetch.py` only issues GraphQL `query`, never a mutation |
| T22 | No credentials exposed | PASS | Frontend calls only this backend's own `/api/dev/collection-thin-content/*`; no token/secret in any new file |
| T23 | No duplicate infrastructure / existing pages unaffected | PASS | Reused `shopify_client`, `google_client`, `background_job`, `db.get_conn`, `jreq-*` CSS, status vocab; `py_compile`+import test confirm no other dev task broken |

## Overall result: PASS (Level 1 scope only)

Level 2/3 (content generation, live preview, auto-publish) intentionally NOT implemented — not scored here.

## Caveat

T18 (filters) and full click-through UI testing were verified by reading the component logic and via a
successful `vite build`, not by opening a running browser session in this environment — flagged here
rather than claimed as fully browser-verified.
