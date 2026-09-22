# Capability — Anti-repeat "Regenerate" pattern for local-LLM content generation

**Date:** 2026-09-22
**Owner:** dm-dashboard dev tooling
**Status:** Live, proven in production (Meta Title & Description Audit)

## What it is

A reusable fix pattern for any "Regenerate" button backed by the
self-hosted local LLM (LOCAL_LLM_* env vars, the same pattern already
used across `alt_text_keywords`, `meta_audit`, `collection_thin_content`,
`geo_visibility`, `kamsi_blog_title_finder`): identical or near-identical
inputs to an LLM call can produce identical or near-identical output if
(a) no `temperature` is set on the call (defaults to low/near-greedy
sampling) and (b) the prompt has no awareness the call is a "regenerate,
give me something different" request rather than a fresh generation.

## The fix

1. Set an explicit `temperature` (0.9 proven to work well) on the local
   LLM call.
2. When a previous generation exists for the same input (tracked via
   whatever log/history table the feature already has), fetch it and
   inject an explicit instruction block into the prompt: "A previous
   version was already generated: '{previous_text}'. Your new version
   MUST take a genuinely different angle/wording — do not just swap one
   or two words."

## Where it's proven

`backend/app/dev_tasks/meta_audit/generate.py` — found and fixed
2026-09-22 after a real user bug report (Regenerate producing
byte-identical output on a real product). Live-tested: 3 consecutive
regenerates on the same real product/keyword produced 3 genuinely
distinct outputs (previously identical/near-identical); re-confirmed
directly against production.

## When to reuse this

Any future "Regenerate" button on an AI-generated field in this
codebase that currently just re-calls the same prompt with the same
inputs should check: does it set a temperature? Does the prompt know
it's a regenerate? If either answer is no, this exact pattern applies
directly — see `meta_audit/generate.py`'s `_call_local_llm`/
`_PREVIOUS_VERSION_BLOCK` for the reference implementation.
