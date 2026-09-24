# Evidence — Task 13 (Hetheesha) Phase 3: French Keyword Dataset + Seed Processing

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase2-datasource-layer_evidence]],
[[2026-09-24_task13-french-keyword-research-source-map]]

## Scope

Data preparation only: seed generation from real ledsone.fr data, French
normalization, multi-source provenance merging (no duplicate rows),
GSC/Shopify-URL enrichment, and Keyword Planner enrichment reusing the
Phase 2 provider as-is. No intent/modifier classification, clustering,
URL mapping, gap/cannibalisation detection, approval workflow, or
dashboard UI — no LLM calls anywhere in this phase.

## Files changed (dm-dashboard, uncommitted — pending coordinator review)

- **Modified:** `backend/app/hetheesha_task13.py` — extended in place
  (same file as Phase 2, no new module): schema additions
  (`normalized_term`, `status`, `source_refs`, `gsc_metrics`,
  `candidate_urls`, `run_id` columns on `hetheesha_kw13_seed_keywords`;
  widened `run_type` CHECK on `hetheesha_kw13_research_runs` to add
  `seed_dataset_build`), plus new functions (`normalize_keyword`,
  `_validate_seed_term`, `_upsert_seed_keyword`, `build_seed_dataset`,
  `enrich_seeds_with_gsc`, `attach_candidate_urls`,
  `enrich_seeds_with_keyword_planner`) and 7 new API endpoints under
  `/api/hetheesha/task13/seed-dataset/*`.

No other files touched. No `.env` changes. No Shopify writes. No
deployment.

## Live test results (2026-09-24, run against real systems)

### Normalization
```
normalize_keyword('  Applique   Murale  ') == normalize_keyword('applique murale')  -> True
normalize_keyword('applique murale') != normalize_keyword('applique murale led')     -> True
```
Confirms casing/whitespace collapse merges duplicates while meaningful
word differences stay separate, per spec section 6.

### Seed generation (real Shopify FR collections + real GSC queries)
```
build_seed_dataset(gsc_days=30, top_gsc_queries=80)
-> {'run_id': 5, 'status': 'SUCCESS', 'collections_considered': 64,
    'gsc_queries_considered': 80, 'seeds_created': 144,
    'seeds_merged_into_existing': 0, 'rejected': []}
```
Sample real French terms produced (source: shopify_collection, from real
ledsone.fr collection titles — NOT literal UK translation):
`Applique murale`, `Plafonniers`, `Ampoule LED`, `Rosaces de plafond`,
`Transformateurs LED`, `Câbles`, `Lumière d'araignée`, `Abat-jour`,
`Éclairage de table` — French accents preserved correctly (confirmed via
UTF-8 output, an earlier `?` display was a terminal-encoding artifact
only, not data corruption).

### Duplicate-merge proof (real code path, real existing seed)
```
term = 'Applique murale' (already seeded from shopify_collection)
_upsert_seed_keyword(term, 'manual_approved_seed', 'Approved by Hetheesha 2026-09-24', ...)
-> rows before: 1, rows after: 1, was_new: False
-> merged source_refs: [
     {'source': 'shopify_collection', 'source_reference': 'https://ledsone.fr/collections/applique-murale'},
     {'source': 'manual_approved_seed', 'source_reference': 'Approved by Hetheesha 2026-09-24'}
   ]
```
Proves spec section 7's requirement directly: the same normalized
keyword from two different real sources merges into ONE row with both
provenance entries preserved, not a duplicate row.

### GSC enrichment
```
enrich_seeds_with_gsc(start='2026-08-25', end='2026-09-24')
-> {'run_id': 8, 'status': 'SUCCESS', 'seeds_matched': 85, 'seeds_unmatched': 59}
```
85 of 144 seeds matched a real GSC query for ledsone.fr in the real
30-day window and got real clicks/impressions/ctr/position/page_url
attached. The 59 unmatched seeds correctly remain valid rows (spec
section 12 — missing one source must never cause exclusion).

### Candidate URL attachment (Shopify context, NOT primary URL)
```
attach_candidate_urls()
-> {'run_id': 9, 'status': 'SUCCESS', 'seeds_with_candidate_urls': 95}
```
Example: "Applique murale" got 10 real candidate product URLs from the
live Shopify FR inventory (e.g.
`https://ledsone.fr/products/applique-murale-clairage-int-rieur-pour-tuyaux-steampunk`),
each explicitly labeled `"status": "Candidate URL"` — never presented as
a primary URL decision (that's Phase 6).

### Keyword Planner enrichment (batched, correctly blocked)
```
enrich_seeds_with_keyword_planner()
-> {'status': 'BLOCKED_CONFIG_REQUIRED',
    'batches': [8 batches of <=20 seeds each, all BLOCKED_CONFIG_REQUIRED],
    'seeds_considered': 144}
```
Correctly batched at 20 per call (Google Ads API's own seed limit,
already enforced in Phase 2's `fetch_keyword_ideas_fr`), called
sequentially (no concurrency, per spec section 17). Every batch honestly
reports the same blocked state re-confirmed in Phase 1/2 — zero fake
keyword metrics written.

### Status distribution after enrichment
```
Counter({'Partial': 85, 'Missing Metrics': 59})
```
85 seeds have GSC metrics only (Keyword Planner blocked) = `Partial`; 59
have neither = `Missing Metrics` (enrichment was attempted, nothing
came back) — matches the documented status model exactly, no seed was
silently dropped.

### Regression check
```
keyword_planner_status() -> same result as Phase 2 (still correctly blocked, 5 missing vars)
get_shopify_inventory() -> 1,178 rows (same Phase 2 inventory, unaffected)
```
Confirms Phase 2 functions and data are untouched and still work
identically after the Phase 3 schema extension.

## Database changes (app's own DB, `get_conn()` — never the read-only
business DB)

- `hetheesha_kw13_seed_keywords`: 6 new columns added via idempotent
  `ADD COLUMN IF NOT EXISTS` (no data loss, no existing constraint
  removed — only the new `run_type` CHECK on `hetheesha_kw13_research_runs`
  was dropped+re-added to add one new value).
- New unique index `hetheesha_kw13_seed_keywords_norm_uidx` on
  `(normalized_term, language, country)` — the actual dedup key.
- Confirmed via live test: 144 real seed rows, 17 real run-history rows
  recorded across seed generation + GSC enrich + candidate-URL + 8
  Keyword-Planner-attempt batches.

## Security check

No secrets printed anywhere in code, test output, or this file.
`GOOGLE_ADS_*` and `SHOPIFY_FR_ADMIN_TOKEN` referenced by name only.
`.env` not modified.
