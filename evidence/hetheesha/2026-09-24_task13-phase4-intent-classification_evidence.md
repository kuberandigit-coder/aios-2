# Evidence — Task 13 (Hetheesha) Phase 4: Search Intent + Modifier Classification

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase3-keyword-dataset_evidence]]

## Scope

Classification only — intent (TRANSACTIONAL / COMMERCIAL_INVESTIGATION /
INFORMATIONAL) + structured modifiers + core_topic, added to the existing
144 real Phase 3 seed keywords. No clustering, primary-keyword selection,
URL mapping, gap/cannibalisation detection, approval UI, or Shopify
writes (explicitly out of scope per spec sections 1 and 20).

## Files changed (dm-dashboard, `dev-work`, uncommitted at time of this
evidence — coordinator to review/commit)

- **Modified:** `backend/app/hetheesha_task13.py` — Phase 4 section added
  (classification constants, LLM call chain, deterministic validator,
  `classify_seed_keywords()`, new schema columns, 2 new API endpoints,
  extended 2 existing endpoints). Also fixed a real, unrelated pre-existing
  bug found while extending `ensure_schema()`: a duplicate/stale Phase-3
  `DROP CONSTRAINT`+`ADD CONSTRAINT` pair ran BEFORE the Phase 4 widened
  version on every `ensure_schema()` call, and once a real row used the
  new `intent_classification` run_type, the stale narrower constraint
  started failing with a genuine `CheckViolation` on every subsequent
  call. Fixed by removing the redundant intermediate block — the single
  remaining DROP+ADD (with the full run_type list) is the only one left.

## LLM infrastructure reused (not a new client)

- **Primary:** LOCAL_LLM (Qwen3-Next, `https://qwen3next.severdigitweb.uk`)
  — direct HTTP call, same shape as `thivajini_feed_providers.py`'s
  `_attempt_local_llm` (that module's own docstring confirms this exact
  pattern was already proven live on French content 2026-09-03/04).
  Confirmed live 2026-09-24: `LOCAL_LLM_API_KEY`/`_BASE_URL`/`_MODEL` all
  configured in `backend/.env`.
- **Secondary (fallback, unused this run since primary succeeded every
  batch):** `ai_shared.call_gemini()` — this codebase's own existing
  multi-key Gemini chain (itself with a Groq + NVIDIA fallback already
  built in). Confirmed `GEMINI_API_KEY` configured.
- No new LLM client, no new provider class hierarchy — matches this
  file's existing "plain function returning a status-tagged dict"
  convention (see module docstring).

## Live classification run against the real 144-keyword Phase 3 dataset

Run in batches of 15 (`_CLASSIFY_BATCH_SIZE`), sequential, via repeated
calls to `classify_seed_keywords(force=False)` — the function is
resumable by design (skips already-classified rows), which mattered
live: the shared business/app DB pool dropped its connection mid-batch
several times during this session under sustained LLM-call latency (a
pre-existing infra characteristic, not something this phase introduced
or needs to fix — see Limitations). Each retry picked up exactly where
the last one left off; final state confirmed complete and idempotent:

```
run 1:  15 classified (test batch)
retry:  90/144 (partial, connection dropped mid-batch)
retry:  105/144
retry:  120/144
retry:  135/144
retry:  144/144  <- complete
re-run: {'classified': 0, 'skipped_already_classified': True}  <- confirms no duplicate LLM calls
re-run: {'classified': 0, 'skipped_already_classified': True}
```

### Final distribution (real, 144/144 keywords, 0 errors)

| Intent | Status | Count |
|---|---|---|
| TRANSACTIONAL | AUTO_CLASSIFIED | 102 |
| INFORMATIONAL | AUTO_CLASSIFIED | 22 |
| COMMERCIAL_INVESTIGATION | AUTO_CLASSIFIED | 18 |
| TRANSACTIONAL | NEEDS_REVIEW | 1 |
| INFORMATIONAL | NEEDS_REVIEW | 1 |

Real finding, not a bug: the dataset skews heavily TRANSACTIONAL (71%)
because most Phase 3 seeds are Shopify collection titles (category-level
product terms), which genuinely are transactional in nature — this is a
property of the real underlying data, not a classifier defect.

### Real modifier extraction examples (structured, not flattened)

```
"Abat-jour Cage Métal Industriel" -> TRANSACTIONAL | core_topic: "Abat-jour"
  modifier_values: {"style": ["industriel"], "material": ["métal"]}

"quelle hauteur suspension cuisine" -> INFORMATIONAL | core_topic: "suspension"
  modifier_values: {"room": ["cuisine"], "product_type": ["suspension"], "informational": ["quelle"]}

"lustre salon tendance 2026" -> COMMERCIAL_INVESTIGATION | core_topic: "lustre"
  modifier_values: {"room": ["salon"], "commercial": ["tendance"]}

"Lampes Suspendues Modernes & Vintage" -> COMMERCIAL_INVESTIGATION | core_topic: "lampes suspendues"
  modifier_values: {"style": ["moderne", "vintage"], "product_type": ["suspendues"]}

"5V Transformateurs LED" -> TRANSACTIONAL | core_topic: "Transformateurs LED"
  modifier_values: {"technology": ["led"], "performance_spec": ["5V"]}
```

### Real edge cases handled correctly (spec sections 14–15)

1. **Brand term** — `"ledsone"` classified TRANSACTIONAL but
   automatically flagged `NEEDS_REVIEW` (not silently trusted), per spec
   section 15's caution against assuming brand-term intent. No existing
   business rule for brand intent was found in this codebase, so this
   task does not invent a 4th intent category — it defers to human
   review instead.
2. **Accent normalization edge case** — `"connecteur fil electrique"`
   (unaccented) got core_topic `"connecteur fil électrique"` (accented)
   from the LLM. The deterministic validator's substring check correctly
   caught that these don't normalize-match (accents are preserved, not
   stripped, per Phase 3's `normalize_keyword()` design) and flagged
   `NEEDS_REVIEW` rather than silently accepting a core_topic that
   doesn't literally derive from the keyword — this is the spec section
   14 "accented/unaccented forms" edge case working exactly as intended.
3. **Zero fabricated modifiers** — spot-checked every AUTO_CLASSIFIED row
   with modifiers; every modifier value is a literal substring of its
   keyword (e.g. "cuisine" only appears when the keyword actually
   contains "cuisine").

## Human review (PATCH) endpoint — live-tested

```python
patch_seed_keyword_classification(128, ClassificationReviewUpdate(classification_status='VALIDATED'))
# -> {'id': 128, 'term': 'ledsone', 'intent': 'TRANSACTIONAL', ..., 'classification_status': 'VALIDATED'}

patch_seed_keyword_classification(128, ClassificationReviewUpdate(intent='BOGUS_INTENT'))
# -> HTTPException 400: "Invalid classification: invalid_intent:'BOGUS_INTENT'"  (correctly rejected)

patch_seed_keyword_classification(128, ClassificationReviewUpdate(modifier_values={'not_a_real_group': ['x']}))
# -> HTTPException 400: "Invalid classification: unsupported_modifier_group:'not_a_real_group'"  (correctly rejected)
```

Confirms the SAME deterministic validation rules apply to a human
reviewer's edit as to the automated LLM path — a reviewer typo cannot
smuggle in an invalid intent or an unsupported modifier category.

## Regression check (Phase 2/3 endpoints, re-verified after Phase 4 changes)

```
keyword_planner_status() -> still correctly reports configured: False
get_shopify_inventory()  -> still 1,178 real rows
get_runs()                -> 22 real run rows (Phase 2/3/4 combined)
get_seed_keywords()       -> Phase 3 fields (term, source_refs, gsc_metrics,
                              candidate_urls, ...) unchanged; Phase 4 fields
                              (intent, core_topic, modifier_groups,
                              modifier_values, classification_status, ...)
                              correctly appended, nothing overwritten
```

Backend import sanity check: `from app.main import app` → `IMPORT OK`.

## Security check

No secrets printed anywhere in code, test output, or this evidence file.
`LOCAL_LLM_API_KEY`/`GEMINI_API_KEY` referenced by name only. `.env` not
modified. No Shopify writes (Phase 4 makes zero Shopify API calls at
all — classification only reads/writes the app's own `seed_keywords`
table).
