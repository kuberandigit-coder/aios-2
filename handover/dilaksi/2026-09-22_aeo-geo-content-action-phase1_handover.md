# Handover — AEO/GEO Content Draft Generation, Dilaksi Phase 1

Date: 2026-09-22
Owner: Dilaksi
Reviewer: project owner/team

## What was implemented

Extended the existing, live AI Overview tracker (`geo_visibility` dev task) with a Content Action
draft/review workflow. An actionable result (AI Overview=YES, LEDSone Cited=NO, Priority=HIGH/MEDIUM) can
now be turned into a "Content Action" → AI-generated draft content (via the existing local LLM) → human
review/edit → Approve/Reject → "Ready for Shopify" label. **No Shopify write of any kind happens in this
phase** — Shopify publishing is explicitly Phase 2, not built.

## Files changed

- `backend/app/dev_tasks/geo_visibility/schema.py` — new `geo_visibility_content_actions` table
  (migration-safe `CREATE TABLE IF NOT EXISTS`).
- `backend/app/dev_tasks/geo_visibility/content_actions.py` (new file) — CRUD, target resolution, prompt,
  local LLM call, output validation, generation pipeline.
- `backend/app/dev_tasks/geo_visibility/router.py` — 7 new endpoints, all under the existing
  `/api/admin/dev-tasks/geo-visibility` prefix (no new router/prefix created).
- `frontend/src/admin/pages/dev-tasks/GeoVisibility.jsx` — "Create Content Action" button on an actionable
  result's detail modal, a `ContentActionPanel` (generate/edit/regenerate/approve/reject inline), and a new
  "Content Actions" tab listing every action with collection/priority/status filters.

## API endpoints added

- `GET /content-actions/duplicate-check?queryId=` — checks for an existing active action first.
- `POST /content-actions` — create (enforces the actionable-gap rule server-side).
- `GET /content-actions` / `GET /content-actions/{id}` — list/get.
- `POST /content-actions/{id}/generate` — runs the local LLM generation pipeline.
- `PUT /content-actions/{id}/status` — Approve/Reject/etc, never touches Shopify.
- `PUT /content-actions/{id}/content` — human edit, preserves the original AI draft separately.
- `POST /content-actions/{id}/group` — adds another related query to an existing action.

## Database changes

New table `public.geo_visibility_content_actions` — references `geo_visibility_results(id)` (the
originating, immutable AI Overview result), never modifies that table or `geo_visibility_queries`.
`query_ids` is a JSONB array (query grouping). `generation_history` is a JSONB array preserving every prior
AI draft before a Regenerate overwrites `generated_content`/`generated_question`. `final_content`/
`final_question` hold a human edit separately from the AI-generated `generated_content`/`generated_question`
— the original is never overwritten.

## Local LLM integration used

The SAME self-hosted local LLM (`LOCAL_LLM_API_KEY`/`LOCAL_LLM_BASE_URL`/`LOCAL_LLM_MODEL` env vars) already
used by 3 other AI-generation dev tasks in this codebase, with the same Gemini fallback
(`ai_shared.call_gemini`) if it's unreachable. No new AI provider was added.

## Content prompt location

`backend/app/dev_tasks/geo_visibility/content_actions.py`'s `_PROMPT_TEMPLATE` — preserves the exact
business rules from the task spec: FAQ vs paragraph format decision by query intent, answer the query
directly in the first sentence, never invent specs/claims/prices/guarantees, "Insufficient source
information to safely draft this claim" fallback when facts aren't available. Output is requested as strict
JSON (`format`, `formatReason`, `question`, `content`, `placementNote`) and validated before being saved —
a malformed response is rejected with a clear error, never silently saved as valid content.

## Content generation flow

Existing AI Overview Result (immutable, unchanged) → actionable-gap check (server-side) → Create Content
Action (copies real evidence: priority, competitor domain, structural diagnosis, resolved target) →
Generate (local LLM, Gemini fallback, JSON-validated) → stored as `Draft` → human Review/Edit/Regenerate →
Approve/Reject → "Ready for Shopify" is a status label only, no Shopify call.

## Human approval flow

Draft → (optional Edit, stored separately in `final_content`/`final_question`) → (optional Regenerate,
previous draft preserved in `generation_history`) → Approve (sets `approved_at`) or Reject. Approving never
publishes anything — it only records that a human has signed off on the draft for a future, separate
Shopify-publishing phase.

## Query grouping implementation

`query_ids` JSONB array on the action row; `POST .../group` appends another query id without duplicating.
Phase 1 grouping is manual/human-driven (the spec explicitly does not require automatic grouping) —
collection-level mapping is sufficient per explicit instruction.

## Target page handling

Collection-level only (Phase 1 scope, per explicit instruction). `resolve_target()` reads the existing
Shopify collections snapshot; if a collection can't be resolved, reports `"Product mapping not available."`
rather than guessing. Product-level mapping does not exist and was not built.

## What was intentionally NOT implemented

- Any Shopify write/publish capability (Phase 2).
- Automated/scheduled re-checking of a query after content is (eventually, manually) published.
- Product-level query-to-product mapping (collection-level only).
- Before/after citation comparison view (the underlying data already supports it via
  `geo_visibility_results`' append-only history — a future phase could add a comparison view without new
  data collection).
- Automatic query grouping (human-driven only in Phase 1).

## Tests performed

Live end-to-end test against a real database row (see evidence file for full detail): create, generate
(real local LLM call), edit, approve, duplicate-check, regenerate-with-history-preservation. Backend import
+ route registration check. Frontend `vite build`. Test data removed after verification.

## AIOS files updated

- `prompts/dilaksi/2026-09-22_aeo-geo-content-action-phase1_prompt.md`
- `evidence/dilaksi/2026-09-22_aeo-geo-content-action-phase1_evidence.md`
- `validation/dilaksi/2026-09-22_aeo-geo-content-action-phase1_validation.md`
- `handover/dilaksi/2026-09-22_aeo-geo-content-action-phase1_handover.md` (this file)
- `source-map/2026-09-22_aeo-geo-content-action-phase1_source_map.md`
- `capability/2026-09-22_ai-faq-schema-generation-pattern_capability.md` — UPDATED (extended, not
  duplicated) to record this feature as a second confirmed consumer of the same local-LLM generation
  pattern.
- `closure/dilaksi/2026-09-22_dilaksi_aeo-geo-content-action-phase1_closure.md` — scoped to Phase 1 only,
  does NOT close the overall AEO/GEO Content Action initiative (Phase 2 intentionally not implemented).

## Known limitations

- Target resolution is collection-level only; a query genuinely about one specific product will still
  generate content framed at the collection level.
- The local LLM's placement-note recommendations are advisory text, not verified against the live page's
  actual HTML structure beyond what was passed as context.
- No automated way (yet) to know whether an Approved draft was actually copied into Shopify by a human —
  that tracking would belong to Phase 2 alongside the write capability itself.

## Recommended Phase 2

Per the task spec's own final note: Approved Content → Shopify Write → Publish Tracking → Re-check →
Before/After Citation Measurement. The Shopify-write step has no existing precedent in this codebase beyond
`alt_text_keywords/shopify_write.py`'s narrowly-scoped-token pattern (image alt text only) — that safety
design (separate write-scoped token, live re-check before writing, sequential not bulk) should be the
starting point when Phase 2 is scoped.
