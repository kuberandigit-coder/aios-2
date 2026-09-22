# Validation — Kamsi Task 08d: Top 10 Blog Title Finder (Google Search Only)

Date: 2026-09-22
Reviewer: (pending human review)

| Requirement | Test | Result | PASS/FAIL/PARTIAL | Evidence reference |
|---|---|---|---|---|
| Correct source (Shopify) | `page_reader.resolve_url()` reads via `shopify_client.graphql(STORE='ledsone_uk', ...)`, only ledsone.co.uk URLs accepted | Code review + import check | PASS | evidence.md #1, #2 |
| New isolated SerpAPI integration | `serpapi_kamsi.py`, env var `KAMSI_SERPAPI_KEY`, separate module, zero import coupling to `sajeepan_lens_serpapi.py` | `grep` confirmed no import, only docstring mention | PASS | evidence.md #5 |
| No fabricated SERP data | `analysis.classify_serp()` only reads fields SerpAPI.com actually returns (`.get()` defensive); never invents rank/title/url/domain | Code review + unit test with schema-shaped sample data (not live) | PASS (logic) / **UNTESTED (live)** | evidence.md #4, "What was NOT live-tested" |
| Ads excluded from organic Top 10 | `classify_serp()` reads `ads` separately, never merges into `top10` | Unit test: 1 Ad correctly separated from 3 organic | PASS | evidence.md #4 |
| Shopping excluded from organic Top 10 | `classify_serp()` reads `shopping_results` separately | Unit test: 1 Shopping result correctly separated | PASS | evidence.md #4 |
| Blog/article classification | URL-path heuristic (`/blog/`, `/guide/`, etc.), documented limitation when evidence is insufficient | Unit test: blog-path URLs flagged true, product page flagged false | PASS (conservative, documented) | evidence.md #4 |
| Fewer-than-10 handling | `router.py`'s `run_research()` sets `NO_ORGANIC_RESULTS` status and a warning when `top10` is short/empty; never pads with fake rows | Code review | PASS | router.py |
| Title <= 70 chars | `generation.qa_check()`'s `maxLength70` check | Unit test: 80-char title correctly failed | PASS | evidence.md #4 |
| Keyword present in title | `qa_check()`'s `keywordPresent` check | Unit test: title missing keyword correctly failed | PASS | evidence.md #4 |
| Originality (no copy/close-rewrite of Top 10) | `qa_check()`'s exact + `SequenceMatcher`-based (>=85%) similarity checks | Unit test: exact duplicate correctly failed both checks | PASS | evidence.md #4 |
| No auto-publish to Shopify | Zero Shopify-write calls anywhere in `kamsi_blog_title_finder/` (only reads via `page_reader.py`) | Code review — no write mutation exists in the package | PASS | source-map.md |
| Human approval workflow | `Draft` / `Ready for Review` / `Approved` / `Rejected` / `Needs Edit` statuses; Approve endpoint never calls Shopify | Code review | PASS | router.py |
| History persisted | 3 new tables (`kamsi_blog_title_research`/`_serp_results`/`_generations`), `GET /research` list endpoint | Live schema creation confirmed against real DB | PASS | evidence.md #3 |
| SerpAPI key never exposed | Read via `os.environ.get()` only, never returned in any response payload, never logged | Code review | PASS | serpapi_kamsi.py |
| Dev Tasks registration | Registered in `AdminLayout.jsx`, `DevLayout.jsx`, `dev_tasks/__init__.py` | Route registration + frontend build both confirmed live | PASS | evidence.md #2, #6 |
| UAM — Kamsi granted | `access_grants` row inserted: `tools.DevKamsiBlogTitleFinder` -> `kamsi` | Live DB `SELECT` confirmed exactly one row | PASS | evidence.md #7 |
| UAM — no unintended grant | Same query confirmed no other staff key present for this task_key | Live DB `SELECT` | PASS | evidence.md #7 |
| Sajeepan regression | Sajeepan Lens module import + route count unchanged (29 routes before/after) | Live import + route count check | PASS | evidence.md #5 |
| Existing Development Tasks regression | Full route count (480) and geo-visibility (22) route count unchanged aside from the 7 new additions | Live route count check | PASS | evidence.md #5 |
| Existing UAM regression | `access_grants` router untouched, 3 routes still present | Live route count check | PASS | evidence.md #5 |
| **Live Google UK SERP retrieval works end-to-end** | Full `/research` pipeline against a real LEDSone URL with a real SerpAPI call | **RUN 2026-09-22 (later) — real key added, 9 real organic results returned** | **PASS** | evidence.md UPDATE section |
| Live LLM keyword extraction / title generation | Full pipeline call to `LOCAL_LLM_*` / Gemini fallback | **RUN — real keyword "2 Core Round Cable" extracted, real title generated and passed QA** | **PASS** | evidence.md UPDATE section |
| Verify re-check works, no extra credit spent | `POST /generations/{id}/verify` | **RUN — QA re-confirmed PASS, `totalSearchesLeft` unchanged by the verify call** | **PASS** | evidence.md UPDATE section |
| Real quota tracking | `GET /account` | **RUN — `totalSearchesLeft` correctly dropped 249 -> 248 for the one research call only** | **PASS** | evidence.md UPDATE section |
| UI usable/readable (post-feedback) | Tabs (Research/Generated Titles/API Limits), scoped CSS, wider layout, Verify button, user attribution | Frontend build + manual code review against explicit user screenshots/feedback | PASS | KamsiBlogTitleFinder.jsx/.css |
| Modal layout fixed (round 2 feedback) | Generated Title Details modal — Source URL full-width, stat cards evenly spaced | Frontend build + code review | PASS | KamsiBlogTitleFinder.jsx/.css |
| "Kamsi" removed from all visible page text | grep across component | No visible "Kamsi" remaining, only internal identifiers | PASS | — |
| New 10-candidate title prompt | `generate_title()` live call with real keyword/Top10 | 10 real, distinct candidates, varied formats, concrete reasoning | PASS | evidence.md round-2 update |
| Candidate selection -> QA -> review lifecycle | Full DB round-trip: create candidates, `/select`, QA, status transition | `generatedTitle`/`selectedFormatType`/`selectedReason` populated correctly, QA ran, status moved to Ready for Review | PASS | evidence.md round-2 update |
| Schema migration safe on already-deployed table | `ensure_schema()` re-run against real DB | New columns + constraint added without error, no data loss | PASS | evidence.md round-2 update |

## Overall

**PASS** — every requirement is now implemented and verified, including
the one genuinely live, end-to-end acceptance test (a real Google UK
search returning real SERP data through the new integration), which was
blocked pending a real `KAMSI_SERPAPI_KEY` and has now been run
successfully. All commits pushed to `dev-work`. Remaining: merge to
`main` / deploy to production, which needs explicit instruction per this
project's standing convention (see handover.md).
