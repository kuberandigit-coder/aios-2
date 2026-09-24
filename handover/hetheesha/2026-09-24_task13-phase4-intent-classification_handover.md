# Handover — Task 13 (Hetheesha) Phase 4: Search Intent + Modifier Classification

**Owner:** Hetheesha
**Date:** 2026-09-24
**Status:** Phase 4 Intent & Modifier Classification Completed —
Clustering Pending (Phases 5–10 not started)

## What was completed

All 144 real Phase 3 seed keywords for ledsone.fr classified by search
intent and structured modifiers, using this codebase's own existing local
LLM infrastructure — no new classification service, no clustering, no URL
mapping, no dashboard UI (all correctly out of scope for this phase).

## Where the code lives

- `backend/app/hetheesha_task13.py` — Phase 4 section appended after the
  Phase 3 section (same file, same router, same DB table extended).
- Uncommitted at handover time — the coordinator reviews/commits/pushes
  to `dev-work` separately (same pattern as Phases 2/3).
- **Not deployed** — no Vercel/production push.

## Classification model

Exactly 3 intents (no more): `TRANSACTIONAL`, `COMMERCIAL_INVESTIGATION`,
`INFORMATIONAL`. 11 modifier groups per the spec's taxonomy: `room`,
`product_type`, `technology`, `socket_fitting`, `style`, `colour`,
`material`, `size_form`, `performance_spec`, `commercial`,
`informational`. A `core_topic` field is extracted per keyword — the
semantic core/topic signal for Phase 5 clustering, explicitly NOT a
renamed keyword or a cluster's eventual primary keyword.

## LLM chain

Primary: LOCAL_LLM (Qwen3-Next) direct call. Fallback: `ai_shared.call_gemini()`
(this app's own existing multi-key Gemini + Groq + NVIDIA chain). Every
LLM response — from either provider — passes through the SAME
deterministic validator (`_validate_classification_item`) before
anything is saved; malformed output never reaches the database as
real classification data, it gets `classification_status='ERROR'`
instead.

## Real results

144/144 keywords classified, 0 hard errors. Distribution: 102
TRANSACTIONAL, 22 INFORMATIONAL, 18 COMMERCIAL_INVESTIGATION (2 of these
124 auto-classified rows additionally flagged NEEDS_REVIEW). This
transactional skew is a genuine property of the real dataset (mostly
Shopify collection/category names), not a classifier bug — worth keeping
in mind for Phase 5 clustering, since a heavily transactional keyword set
may produce fewer natural informational/commercial clusters than the
spec's worked examples imply.

Two rows flagged `NEEDS_REVIEW` for real, substantive reasons (not
arbitrarily): a brand term ("ledsone") and a genuine accent-normalization
edge case ("connecteur fil electrique" vs "électrique" in the model's own
core_topic answer). Human review flow (`PATCH
/seed-dataset/keywords/{id}/classification`) is live-tested and correctly
re-validates any human-submitted edit with the identical rules used for
the automated path.

## Database changes

8 new columns added to the EXISTING `hetheesha_kw13_seed_keywords` table
(no new table): `intent`, `core_topic`, `modifier_groups` (JSONB),
`modifier_values` (JSONB), `classification_status`, `classified_at`,
`classification_source`, `classification_error`. All Phase 3 columns
(`term`, `normalized_term`, `source_refs`, `gsc_metrics`,
`candidate_urls`, `run_id`) are untouched — confirmed via regression
check.

## API endpoints (new/extended, all under `/api/hetheesha/task13/`)

- `POST /seed-dataset/classify` — classify unclassified seeds (or all,
  with `force=true`), batched
- `PATCH /seed-dataset/keywords/{id}/classification` — human review/edit,
  re-validated with the same rules as automated classification
- `GET /seed-dataset/keywords` — extended with `classification_status`
  and `intent` filters, now returns all Phase 4 fields
- `GET /seed-dataset/keywords/{id}` — now returns all Phase 4 fields too

## Known limitations

- The Phase 4 taxonomy (3 intents, 11 modifier groups) is fixed in code
  as Python constants (`_VALID_INTENTS`, `_VALID_MODIFIER_GROUPS`) — no
  existing project convention for either was found, so these are new,
  per spec section 3/6's instruction to "document it" when introducing a
  new model.
- No confidence score exists (by design, per spec section 11) — only the
  4-value status field. A future reviewer UI (later phase) needs to work
  from that status, not a numeric score.
- **Real infra characteristic, not a Phase 4 defect:** the app-DB
  connection pool dropped mid-batch several times during the live
  classification run, under sustained sequential LOCAL_LLM latency. The
  function's skip-already-classified design absorbed this with no data
  loss, but a future Phase 5+ run against a much larger keyword set
  should expect the same and may want a lighter-weight retry wrapper
  around the per-batch DB write specifically (not just connection
  acquisition, which `db.py`'s existing retry logic already covers).

## Unresolved blockers

None for this phase's own scope — Google Keyword Planner remains blocked
(same as Phase 1/2/3) but Phase 4 does not depend on it at all (intent/
modifier classification only needs the keyword text itself).

## Phase 5 starting point

Phase 5 (Keyword Clustering) can read directly from
`hetheesha_kw13_seed_keywords.core_topic` + `modifier_values` +
`intent` — no new join/lookup needed. Recommend clustering scope to
`classification_status IN ('AUTO_CLASSIFIED', 'VALIDATED')` only,
leaving `NEEDS_REVIEW`/`ERROR` rows out of clustering until a human
resolves them via the Phase 4 PATCH endpoint (prevents an unreviewed
brand-term or malformed row from silently anchoring a cluster).

## Current status

Phase 4 complete and verified live against real data. **Do not proceed
into Phase 5 automatically** — awaiting explicit instruction, per the
task's own rule.
