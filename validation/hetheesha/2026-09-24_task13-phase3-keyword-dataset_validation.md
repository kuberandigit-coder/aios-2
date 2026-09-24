# Validation — Task 13 (Hetheesha) Phase 3: French Keyword Dataset + Seed Processing

**Date:** 2026-09-24
**Scope:** Phase 3 only — seed generation, normalization, provenance
merging, GSC/Shopify enrichment, Keyword Planner enrichment (reused as-is
from Phase 2). Not classification, clustering, mapping, or UI.

| Check | Result | Evidence |
|---|---|---|
| Phase 1/2 findings read and re-verified live | PASS | Re-confirmed `GOOGLE_ADS_*` still missing in `backend/.env`; reused Phase 2's `fetch_collections_fr`/`fetch_gsc_queries_fr`/`fetch_keyword_ideas_fr` unmodified |
| A. Seed generation — real French data, no fabricated categories | PASS | 144 real seeds from 64 real Shopify FR collections + 80 real GSC queries; sample terms (Applique murale, Plafonniers, Rosaces de plafond, etc.) all real ledsone.fr category names, zero invented/translated terms |
| B. Normalization — casing duplicates merge, meaningful differences stay separate | PASS | Direct test: `normalize_keyword('Applique Murale') == normalize_keyword('applique murale')` and `!= normalize_keyword('applique murale led')` |
| C. Provenance preserved | PASS | Every seed row carries `source_refs` with `{source, source_reference}`; verified in [[2026-09-24_task13-phase3-keyword-dataset_evidence]] |
| D. Keyword Planner — real metrics mapped if available; France/French targeting present | PARTIAL | Targeting constants added (unverified live, no credential to test against — documented limitation); correctly reports `BLOCKED_CONFIG_REQUIRED`, batched at 20/call, zero fake data |
| E. GSC — real queries mapped correctly | PASS | 85/144 seeds matched real GSC rows for ledsone.fr with real clicks/impressions/ctr/position |
| F. Shopify — current URLs retrieved correctly | PASS | 95/144 seeds got real candidate URLs from the live 1,178-row Shopify FR inventory, explicitly labeled "Candidate URL" not primary |
| G. Missing data — partial records remain valid | PASS | 59 unmatched-GSC seeds and all Keyword-Planner-blocked seeds remain valid rows with `Partial`/`Missing Metrics` status, none dropped |
| H. Duplicate handling — same keyword from multiple sources = one row | PASS | Direct test on real seed "Applique murale": row count stayed 1 after a second-source insert, `source_refs` grew to 2 entries |
| I. Research runs — previous runs preserved | PASS | 17 real run rows recorded this session (`gsc_fetch`/`shopify_fetch`/`keyword_planner_fetch`/`seed_dataset_build`), none overwritten |
| J. Security — no secrets exposed | PASS | No token/secret values in code, test output, or this record |
| K. Regression — existing functionality unaffected | PASS | `keyword_planner_status()` and `get_shopify_inventory()` (Phase 2 functions) re-tested, identical results to Phase 2; `from app.main import app` import sanity check passes |
| No unnecessary duplicate tables created | PASS | Extended existing `hetheesha_kw13_seed_keywords`/`hetheesha_kw13_research_runs` via `ADD COLUMN IF NOT EXISTS` instead of new tables, per spec section 11 |
| No AI/LLM classification performed | PASS | Zero LLM calls anywhere in `hetheesha_task13.py`'s Phase 3 additions — confirmed by code inspection, no `ai_shared`/local-LLM imports added |
| No dashboard UI built | PASS | Zero frontend files touched this phase |

**Overall result: PARTIAL**

Same reasoning as Phase 2: Google Keyword Planner (a required source)
remains genuinely unavailable pending an external Google Ads OAuth
credential — this is expected and correctly, honestly reported (batched
attempts, zero fake data), not a defect in this phase's work. Every other
check is a genuine PASS with live evidence against real ledsone.fr data.

## Regression check

`from app.main import app` → `IMPORT OK` after the Phase 3 schema/logic
additions — no existing route, Phase 2 function, or startup behavior
broken.
