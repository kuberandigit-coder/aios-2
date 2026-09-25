# Validation — Task 15 (Hetheesha): Structured Data Validation, ledsone.fr

**Date:** 2026-09-25
**Evidence:** [[2026-09-25_task15-structured-data-validation_evidence]]

| Requirement | Validation | Result |
|---|---|---|
| Names: package, page, routes, tables, task key, panel key, scope | As specified; no user names, "test" or "task15" in code names | PASS |
| URLs discovered from the public sitemap, classified by template, none invented | Ran on the real sitemap (6 child sitemaps) | PASS (sample) |
| JSON-LD (`@graph`, arrays, invalid JSON), microdata, RDFa extraction; syntax recorded | Ran on real pages; RDFa and invalid-JSON paths not seen in the sample | PASS (JSON-LD) / PARTIAL (RDFa, microdata, invalid JSON) |
| Product checks against live Shopify (name, image, description, sku, gtin, mpn, brand, offers, currency, availability, shipping, returns, ratings) | Ran on 5 real products with the live catalogue (1,117 products, currency EUR); price/currency/AggregateOffer mismatch branches not triggered by real data | PASS (sample) / PARTIAL (mismatch branches) |
| Organization, BreadcrumbList, duplicate/conflict checks | Ran on real pages; duplicate/conflict branches not triggered by the sample | PASS (sample) / PARTIAL |
| GSC via the dedicated credential, real URL Inspection endpoint, bounded sample, 24 h cache, quota handling | 5 real inspections succeeded; quota path and cache reuse not exercised | PASS (calls) / PARTIAL (quota, cache) |
| No invented Search Console UI Enhancements endpoint; GSC labelled separately | Stated in the tab and the module docs | PASS |
| Priority rules and stable issue codes with reasons | Implemented; visible in the results | PASS |
| Fix and re-validation workflow with persistent state and history | One re-validation ran (issue set FAILED, history written); PASSED path and READY_FOR_RECHECK path not exercised | PARTIAL |
| Server-side authorization on writes | 3 write endpoints depend on `require_task_access`; missing/invalid token returned 401; an authorized write was not exercised | PARTIAL |
| Sync Monitor job + dashboard "Run validation" background run + progress | Registered; job not run through the Sync Monitor; UI run button not clicked | PARTIAL |
| Dashboard reads use the newest complete run | Implemented in every read | PASS (code) |
| Overview KPIs, paginated/filterable/sortable lists, detail, CSV with the exact 12 columns | Endpoints ran; CSV header matched; UI not viewed in a browser | PASS (API) / PARTIAL (UI) |
| Eight tabs, states, drawer, Export CSV with Bearer header | `npx vite build` passed; unused-code scan clean | PASS (build) / PARTIAL (not seen in a browser) |
| UAM: task key registered under Hetheesha; no grant rows written | `taskRegistry.js` entry added; grant not written | PASS — grant must be ticked in UAM |
| No Shopify modifications | Only GraphQL queries, no mutations | PASS |
| Data safety: no secrets stored; smoke rows deleted | Row counts 0 after cleanup | PASS |
| Full crawl / full job / deployment | Not run, per the brief | NOT PERFORMED |

**Overall result: PARTIAL.** Nothing failed. Manual verification of the UI and
the full workflow is pending, so no closure record was created.

---

## Update — Action Needed workflow (2026-09-25)

| Requirement | Validation | Result |
|---|---|---|
| Guidance for product schema, duplicate/conflicting, shipping/return, all valid | Mapping checked for 7 sample issue codes; texts follow the requirement | PASS |
| Guidance attached to every issue in drawer, lists and CSV | Code read; frontend builds; backend files compile | PASS (code) / PARTIAL (not seen in browser) |
| No fabricated shipping/return values | Guidance only points to Shopify settings / confirmed policy | PASS |
| Existing 8 tabs, workflow, priorities, CSV columns preserved | Only additive changes | PASS (code) |
| Backend starts with new module | Not run locally (missing local dependency `psycopg_pool`); py_compile passes | PARTIAL |

**Overall: PARTIAL** — manual test pending.
