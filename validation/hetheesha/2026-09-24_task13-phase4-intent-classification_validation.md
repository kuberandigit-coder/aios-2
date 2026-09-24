# Validation — Task 13 (Hetheesha) Phase 4: Search Intent + Modifier Classification

**Date:** 2026-09-24
**Scope:** Phase 4 only — intent + modifier classification of the
existing Phase 3 seed dataset. Not clustering, URL mapping, gap/
cannibalisation detection, or UI.

| Check | Result | Evidence |
|---|---|---|
| Previous phases read (Phase 1/2/3 audit, validation, handover) | PASS | Read `hetheesha_task13.py` in full before writing any Phase 4 code; reused Phase 3's `normalize_keyword()` directly rather than reimplementing |
| Existing LLM infrastructure reused, no new client | PASS | LOCAL_LLM direct-call pattern + `ai_shared.call_gemini()` fallback, matching `thivajini_feed_providers.py`'s already-proven French-content pattern exactly |
| Intent model — exactly 3 categories | PASS | `_VALID_INTENTS = {TRANSACTIONAL, COMMERCIAL_INVESTIGATION, INFORMATIONAL}`, enforced in `_validate_classification_item`; no 4th category invented |
| French language handling | PASS | Real results show correct classification of French wording (comment/quelle/quel → INFORMATIONAL, tendance/meilleur → COMMERCIAL_INVESTIGATION) without English translation |
| Modifier taxonomy — structured, not flattened | PASS | `modifier_values` is a dict keyed by group, each a list of real substrings; `modifier_groups` derived from those same keys (can never disagree) |
| Multiple modifiers per keyword | PASS | Live example: "Abat-jour Cage Métal Industriel" → 2 modifier groups (style, material) in one row |
| Core topic extraction — not the final primary keyword | PASS | `core_topic` is a genuine substring/derivation of the keyword, never a renamed/invented term; validated deterministically against the original keyword |
| Deterministic validation after LLM output | PASS | `_validate_classification_item()` runs on every item regardless of provider; rejects invalid intent, non-object modifier_values, unsupported modifier group, empty modifier list |
| No fabricated confidence score | PASS | Only `classification_status` (AUTO_CLASSIFIED/NEEDS_REVIEW/VALIDATED/ERROR) — no invented numeric confidence anywhere |
| Malformed LLM output never silently saved | PASS | On validation failure, row gets `classification_status='ERROR'` + `classification_error` reason, never intent/core_topic/modifiers written |
| Original Phase 3 fields never overwritten | PASS | `term`/`normalized_term`/`source_refs`/`gsc_metrics`/`candidate_urls` columns untouched — confirmed via regression check (Phase 2/3 endpoints still return identical data) |
| Duplicate LLM call prevention | PASS | Live-confirmed: re-running `classify_seed_keywords(force=False)` after full completion returns `{'classified': 0, 'skipped_already_classified': True}` |
| Batching | PASS | 15 keywords/LLM call (`_CLASSIFY_BATCH_SIZE`), sequential — not 144 separate round trips |
| Brand terms not auto-forced transactional | PASS | "ledsone" flagged `NEEDS_REVIEW` rather than silently trusted, per spec section 15 |
| Ambiguous keywords marked NEEDS_REVIEW, never deleted | PASS | 2/144 real rows flagged (brand term + accent-mismatch core_topic); all 144 rows still present, none dropped |
| Human review endpoint re-validates edits | PASS | Live-tested: an invalid intent and an unsupported modifier group submitted via `PATCH` were both correctly rejected with HTTP 400 |
| Database — reused Phase 3 schema, minimal additions | PASS | 8 new columns added to the EXISTING `hetheesha_kw13_seed_keywords` table via `ADD COLUMN IF NOT EXISTS`; no new table created |
| API — extends existing Task 13 router | PASS | All new/changed routes remain under `/api/hetheesha/task13/*` in the same file; no second router |
| Secrets protected | PASS | No token/key values printed anywhere; `.env` not modified |
| No Shopify writes | PASS | Phase 4 makes zero Shopify API calls |
| No production deployment | PASS | No `vercel deploy`, no push to `main` |
| No unrelated functionality changed | PASS | `git diff` scope limited to the one Phase 4 section + a real, incidental bug fix in `ensure_schema()`'s constraint handling (documented in evidence) |
| No duplicate DB tables/services/capabilities created | PASS | Extended the existing seed_keywords table and the existing router/file rather than creating parallel structures |
| Tests pass for available capabilities | PASS | All 144 real seed keywords classified successfully (0 API errors); edge cases (brand term, accent mismatch) correctly flagged, not silently mishandled |
| Regression (Phase 2/3 unaffected) | PASS | `keyword_planner_status()`, `get_shopify_inventory()` (1,178 rows), `get_runs()` (22 rows), Phase 3 fields on `get_seed_keywords()` all re-verified working after the Phase 4 change |

**Overall result: PASS**

Unlike Phase 2/3, this phase's required source (the local LLM) IS fully
available and WAS successfully used end-to-end against real data with a
real, non-trivial output (144/144 keywords classified, 0 hard errors,
2 correctly self-flagged edge cases). No blocked/unavailable source
applies to this phase's own scope, so PASS is the accurate verdict here
(Phase 2/3's PARTIAL verdict was specifically about Google Keyword
Planner, which this phase does not depend on).

## One real infra issue surfaced (not a Phase 4 defect)

The shared app-DB connection pool dropped its connection mid-batch
several times during the live classification run, under the load of
sequential LOCAL_LLM calls with real network latency. This is a
pre-existing characteristic of the pool (see `db.py`'s own documented
retry-on-acquisition design, which does not cover query-execution
failures mid-transaction) — not something Phase 4 introduced. The
classification function's resumable design (skip already-classified
rows) absorbed this gracefully with no data loss or duplicate writes;
documented as a known operational characteristic in the handover, not
filed as a bug against this phase's own code.
