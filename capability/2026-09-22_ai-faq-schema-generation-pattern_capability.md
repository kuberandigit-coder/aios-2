# Capability — AI FAQ Schema (JSON-LD) Generation Pattern

Date: 2026-09-22
Established by: Collection Page Thin-Content Detector's FAQ Analysis tab
Location: `backend/app/dev_tasks/collection_thin_content/faq_generation.py`

## What this capability is

A reusable, proven pattern for generating schema.org structured data (specifically FAQPage JSON-LD) from
real PAA (People Also Ask) questions via a self-hosted local LLM, with deterministic safeguards against the
two real failure modes LLM-generated structured data hits in practice:

1. **Missing `<script>` wrapper** — an LLM asked for "JSON-LD" will often return bare JSON. Pasting bare
   JSON into a page renders as visible text instead of invisible structured data (confirmed live via a real
   before/after Shopify screenshot). Fix: always wrap in `<script type="application/ld+json">...</script>`,
   validate/re-serialize the inner JSON so a malformed response can never be pasted through broken.
2. **Soft instructions are unreliable** — asking a model to "mention X if relevant" often produces zero
   compliance (confirmed live: a real generation with internal links offered produced no mention at all).
   Fix: never trust the model for something that must deterministically happen — check the output
   afterward and inject programmatically if the model didn't comply
   (`ensure_internal_link_present()`), and separately compute "what was actually used" from the real
   output rather than trusting what was offered (`links_actually_mentioned()`).

## Reusable pieces (all in `faq_generation.py`, all generically named, not collection-specific)

- `_call_local_llm()` — same `LOCAL_LLM_*` env-var pattern + Gemini fallback already used by
  `meta_audit/generate.py` and `alt_text_keywords/ai_alt_text.py`. Copy-per-file convention (established
  elsewhere in this codebase), not centralized.
- `parse_llm_output()` — extracts + validates + re-wraps a `<script type="application/ld+json">` block from
  a raw LLM response, tolerant of stray commentary the model prepends.
- `ensure_internal_link_present()` — deterministic "guarantee X happened" pattern for any soft instruction
  given to an LLM.
- `links_actually_mentioned()` — "report only what's genuinely true in the output, not what was offered" pattern.
- `strip_internal_links_from_jsonld()` — free, instant, no-new-AI-call post-processing edit pattern (edit
  the already-generated output via plain text/regex instead of re-spending a credit + LLM call for a small
  change).

## Frontend pattern (in `CollectionThinContentDetector.jsx`)

- `FaqSchemaPreview` / `linkifyAnswerText()` — renders a JSON-LD FAQPage schema as a real accordion, with
  any embedded URL shown as an actual clickable link (using a real matched page's title) — the preview only;
  the copied/stored schema text stays plain, since structured data is never rendered as a page.
- Per-collection `BackgroundJob` for AI generation (not the audit's single shared job) — proven pattern for
  "many independent slow AI calls, each keyed by its own entity id," reusable for any future per-item AI
  generation feature in this codebase.

## When to reuse this

Any future dev task that needs to (a) generate schema.org structured data via the local LLM, (b) ask an LLM
to conditionally include something and needs it to actually happen reliably, or (c) needs a
credit-conscious "edit the existing AI output for free" action instead of a full regenerate.

## Not reusable / scoped to this task

`primary_keyword_for()` and `pick_internal_links()` are specific to collection-page SEO (title-cleaning,
token-overlap against the Internal Linking content index) — reusable as a pattern, not as-is for a
different domain.
