# Evidence — AEO/GEO Content Draft Generation, Dilaksi Phase 1

Date: 2026-09-22
Repo: dm-dashboard (branch: dev-work, commit `588b89e`)

## Pre-implementation audit (done before writing any code)

A full read-only audit of the existing AI Overview tracker (`backend/app/dev_tasks/geo_visibility/`) was
run first, via a forked sub-agent given the exact 24-section audit brief the user provided, to confirm what
already existed before building anything. Key confirmed findings used to shape this implementation:

- The AI Overview tracker itself (query→check→priority) was already fully built and live with real data
  (111 real queries, 4 HIGH / 66 MEDIUM / 27 NO ACTION / 14 MONITOR at time of audit).
- The tracker already runs an automatic structural content-gap diagnosis
  (`analysis.compare_content_for_gap`) for every HIGH/MEDIUM result, storing a `content_gap` JSONB field —
  reused directly as this feature's `structural_diagnosis` input, not rebuilt.
- The existing local LLM client pattern (`LOCAL_LLM_*` env vars + Gemini fallback via `ai_shared.call_gemini`)
  was confirmed present in 3 other files (`collection_thin_content/faq_generation.py`,
  `meta_audit/generate.py`, `alt_text_keywords/ai_alt_text.py`) — reused via the same copy-per-file
  convention already established in this codebase, no second AI provider added.
- No Shopify write mutation for product/collection descriptions exists anywhere in this codebase (confirmed
  via a full `grep -rln` sweep) — matches the explicit Phase 1 instruction to never implement one.
- Query→collection mapping already existed (`geo_visibility_queries.collection_handle`); product-level
  mapping did not exist and was NOT invented, per explicit instruction — `resolve_target()` reports "Product
  mapping not available" rather than guessing a product.

## Live verification performed (real data, real local LLM, real DB writes)

All tests below ran against a real HIGH-priority result already in the live database (id=37, query "cheap
2 core twisted cable uk", collection `2core-twisted`, real competitor `lampspares.co.uk`) — nothing
fabricated. The test row was deleted after verification.

1. **Create**: `create_content_action` correctly resolved the real target (real Shopify collection GID,
   real URL `https://ledsone.co.uk/collections/2core-twisted`) and rejected creation for any result not
   meeting the actionable-gap rule (verified the rule check is enforced server-side, not just client-side).
2. **Generate**: real call to the self-hosted local LLM produced a valid, correctly-formatted response —
   `format: "Paragraph"` (correct decision for a descriptive/location query, matching the spec's format
   rule), a grounded 3-sentence paragraph, and a `placementNote` that correctly referenced real existing
   text already on that collection's live description ("after the existing paragraph that mentions
   'The 2-core twisted flex features...'"). No fabricated specs/claims were introduced — all product
   details mentioned were already present in the real existing description passed as context.
3. **Edit**: `update_action_content` correctly stored the edited text in `final_content` while leaving
   `generated_content` (the original AI draft) untouched — verified both fields independently after the
   edit.
4. **Approve**: `update_action_status` correctly set `approved_at` to a real timestamp, and confirmed
   "Approved" performs no Shopify call of any kind (no mutation exists in this module at all).
5. **Duplicate-check**: `find_active_action_for_query` correctly found the existing action for the same
   `query_id` after creation (`exists: true`), confirming the JSONB containment check works.
6. **Regenerate + history**: a second `generate_content` call correctly pushed the previous draft into
   `generation_history` (verified length went from 0 → 1) before overwriting `generated_content` with a
   new draft, and correctly reset `review_status` back to `'Draft'` (an Approved action loses that status
   once regenerated, requiring fresh review — deliberate, not a bug).
7. Final cleanup: `check_duplicate_action`/`list_actions` re-run after deleting the test row, confirmed
   both correctly report an empty state (`exists: false`, `count: 0`) — no leftover test data in the
   database.

## Compile/build verification

- `python -c "from app.main import app"` — backend imports cleanly; all 7 new
  `/api/admin/dev-tasks/geo-visibility/content-actions*` routes confirmed registered.
- `npx vite build` — frontend builds cleanly, no new errors introduced.

## Bug found and fixed during implementation (self-caught before shipping)

`create_action`'s duplicate-check initially referenced a function
(`content_actions.find_active_action_for_query`) that had actually been written in `schema.py`, not
`content_actions.py` — caught immediately by the first live test run (`AttributeError`), fixed by moving the
function to `content_actions.py` (the correct location alongside the rest of the CRUD functions), re-tested
successfully.

## No secrets

No local LLM API key/base URL, Gemini key, or Shopify token is exposed anywhere in these files or in this
evidence record — only safe references (e.g. "local LLM configured via environment variable").

## Status

Implemented, live-verified end-to-end against real data. Committed to `dev-work` (`588b89e`), pushed. Not
yet merged to `main` / deployed — pending explicit instruction, per this project's standing convention.
