# Sajeepan — Automation Keyword Finder (Prompt)

**Date:** 2026-08-24
**Team member / Team / Store:** Sajeepan / digital-marketing-member-pages
**Requirement:** REQ-DM-2026-08-SAJE01

## Reconstructed from Claude session history and project evidence

No original prompt text survives in this AIOS. This is a reconstruction from
the migration files' own inline comments, not the actual request — labeled
per the recovery rule that a reconstructed prompt must never be presented as
the original.

## Reconstructed scope (inferred from schema)

Build an "Automation Keyword Finder": for a given product (matched by SKU),
run a Google Lens visual search via SerpAPI to find visually similar
competitor listings, capture their result fields (title, URL, image, heading,
domain, etc.) as evidence, and route every result through a human review gate
(NEEDS_REVIEW / INCLUDED / EXCLUDED) before it counts as a validated
competitor.

Full requirement (per migration 007) extends this into: frequency/category
analysis of INCLUDED competitors, a Phase 2 expansion, a Keyword Planner
cache, attribute validation, and final title/alt-text/Ads-keyword output.

Per migration 008, the end state is a fully automatic weekly 50-product
workflow (not just on-demand manual runs).

## What is NOT known
- The literal wording of Kuberan's/Sajeepan's original request.
- Any business constraints or examples given verbally that shaped the schema
  (e.g. why Canada was chosen as the default search country).
