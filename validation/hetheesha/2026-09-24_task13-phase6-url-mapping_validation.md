# Validation — Task 13 (Hetheesha) Phase 6: Primary Keyword → URL Mapping

**Date:** 2026-09-24
**Scope:** mapping decisions/data only. Evidence:
[[2026-09-24_task13-phase6-url-mapping_evidence]]

| Check | Result | Evidence |
|---|---|---|
| Strong collection match | PASS | fixture test + real CL-0004/CL-0011 |
| Strong product match | PASS | fixture test + real CL-0058 |
| Informational keyword + blog page | PASS (fixture only) | no real Blog inventory exists |
| Informational keyword, no blog → NO_SUITABLE_URL, never a product page | PASS | fixture + 19 real informational clusters |
| No suitable URL / shared-word-only match rejected | PASS | "spot encastrable led" vs LED collections fixture |
| Multiple candidate URLs preserved | PASS | fixture; real CL-0067/CL-0081 (10 stored candidates max) |
| LLM never auto-maps | PASS | fixture; real run: 2 LLM calls → NEEDS_REVIEW |
| Same keyword, multiple GSC URLs → CONFLICT, unresolved | PASS | fixture + 8 real conflicts |
| Inactive Shopify URL excluded | PASS | fixture (DRAFT product) |
| Invalid / fabricated URL prevented | PASS | quality-check fixture + live PATCH 400 |
| Missing GSC data | PASS | fixture; reason states absence of evidence |
| Missing Shopify content/title | PASS | fixture (null title ignored) |
| Ambiguous cluster → NEEDS_REVIEW | PASS | fixture + 10 real clusters |
| Duplicate primary keyword mapping | PASS | fixture + quality check |
| Same-intent clusters sharing a URL → CONFLICT; cross-intent annotated | PASS | fixture + 12 real / 4 real annotations |
| Handle contradicts title → not auto-mapped | PASS | fixture + 3 real |
| APPROVED never automatic | PASS | 0 APPROVED rows; PATCH blocks AUTO_MAPPED |
| Every mapped URL exists in verified inventory | PASS | `_quality_check_mappings(27)` no issues |
| Alternatives preserved, GSC source-labelled | PASS | quality check |
| Original keyword/cluster data unchanged | PASS | Phase 5 quality check still passes; counts identical |
| Prior runs preserved | PASS | runs 26 and 27 both kept |
| Phase 3/4/5 regression | PASS | pure-helper test + live counts |
| Secrets / Shopify write / deploy | PASS | none |
| Automated tests | PASS | 24 fixture tests pass (pytest is not installed in the venv; run with a minimal runner) |
| Successful human PATCH/approve write path | NOT TESTED live | only rejection paths exercised on production rows |
| Blog/page URLs as targets | PARTIAL | inventory has no blogs (FR token lacks `read_content`); GSC proves some exist |
| Page-content-based relevance | PARTIAL | inventory holds titles/handles only, no descriptions/body |

**Overall result: PARTIAL.** The mapping logic, safety rules and quality
checks all pass on real data. The result is PARTIAL — not PASS —
because two required inputs are unavailable: page content and
blog/page inventory (Shopify FR `read_content` scope), which weakens
informational mappings and content-based relevance. Keyword Planner
volumes also remain unavailable (Phase 1 blocker), so no volume is used.

## Duplicate-risk review

- Mapping table/service/routes: one new table
  (`hetheesha_kw13_url_mappings`); no other Task 13 table stores
  URL-selection decisions. `hetheesha_kw13_seed_keywords.candidate_urls`
  (Phase 3) is per-keyword *context*, not a decision — not duplicated.
- Route prefix reused (`/api/hetheesha/task13/url-mappings*`).
- No second LLM client (reuses `_call_local_llm_classify_raw` / Gemini
  fallback); no second Shopify/GSC client.
- Documentation: extends the existing Task 13 record set; no new
  capability record created (see handover).
