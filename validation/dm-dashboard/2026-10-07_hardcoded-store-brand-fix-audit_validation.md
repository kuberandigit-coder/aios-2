# Validation — Hardcoded Store/Brand Fix Audit

Date: 2026-10-07
Reviewer: (pending — Kuberan)

| Check | Result | PASS/FAIL |
|---|---|---|
| Every occurrence of the hardcode in `qa_check.py` found | One occurrence confirmed by full file read, exact line quoted in the evidence doc | PASS |
| Every caller of the affected `qa_check.py` function traced | Full-backend grep confirms exactly one real caller (`blog_optimization/router.py`'s `blog_qa_check`); no other Development Task calls it | PASS |
| Every occurrence of the hardcode in `faq_schema.py` found | Two related hardcodes found (brand sentence + "Use UK English" instruction), both in the same prompt template, both quoted exactly | PASS |
| Every caller of `faq_schema.py`'s affected functions traced | Full-backend grep + direct reads confirm exactly 2 real callers (`blog_optimization`, `collection_thin_content`); `collection_thin_content`'s own hardcoded UK store (`content_fetch.py`) confirmed by direct read, meaning that caller is unaffected by the proposed fix either way | PASS |
| Existing store configuration inspected, no new config proposed | `core/shopify_client.STORES`, `blog_optimization/shopify.SITE_STORES`, `blog_optimization/gsc_sync.SYNC_SITES` all read directly; recommended approach reuses `SITE_STORES`'s shape rather than inventing a new structure | PASS |
| Safest fix proposed for both files | §7 of the evidence doc — domain derived from the already-passed `page_url` in both cases, zero signature/caller changes required | PASS |
| Regression analysis covers every Development Task | §8 of the evidence doc — all 10+ named tasks classified, each with a grep-confirmed basis, no UNKNOWN left unresolved | PASS |
| Blog HTML Automation impact explained | §9 — confirms the fix is a genuine prerequisite but not sufficient alone (Internal Linking's own separate UK-only data source still limits multi-store link suggestions) | PASS |
| No-hardcode review covers related occurrences | §10 — 5 findings classified A/B/C/D, including one (`internal_linking/content_fetch.py`) explicitly flagged as out-of-scope but relevant | PASS |
| Exact file change list produced | §11 — exactly 2 files, no more | PASS |
| No secrets copied into documentation | No token values, keys, or connection strings anywhere in the evidence doc — only file paths, function names, and a fallback literal that's a public domain name, not a secret | PASS |
| No code/database/frontend modified | Confirmed — only documentation files were written this session; `git status` on the dm-dashboard repo shows no changes to either audited file | PASS |
| No deploy/merge/push of dm-dashboard | Confirmed — branch remained `dev-work`, no git operations performed on the dm-dashboard repo at all during this audit | PASS |

## Overall

**PASS.** All 13 validation checks confirmed via direct code inspection, not assumption. See the
evidence doc's §14 for the final recommendation: **APPROVE WITH CONDITIONS** (the `faq_schema.py`
half needs Kuberan's decision on actual DE/FR prompt wording before implementation).
