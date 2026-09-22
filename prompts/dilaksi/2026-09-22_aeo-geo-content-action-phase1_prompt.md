# Prompt — AEO/GEO Content Draft Generation, Dilaksi Phase 1

Date: 2026-09-22
Repo: dm-dashboard

## Original request (condensed, full spec preserved in this session's own conversation record)

"TASK: Implement AEO/GEO Content Draft Generation in the Existing AI Overview Page — Dilaksi Phase 1."
Extend the EXISTING, live AI Overview tracker (`geo_visibility` dev task) so Dilaksi can take an actionable
citation gap and generate AEO/GEO content via the existing local LLM API. Explicit workflow: Existing AI
Overview Result → Action Required → Create Content Action → Select/confirm target page → Generate content
(local LLM) → Review → Edit if required → Approve → "Ready for Shopify". Explicitly NOT Shopify publishing —
that's a separate future phase (Phase 2), never implemented here.

Actionable-gap rule (uses EXISTING stored values only, never recomputes priority): AI Overview = YES AND
LEDSone Cited = NO AND Priority = HIGH OR MEDIUM.

Mandatory first step: full audit of the existing implementation (AI Overview tracker, Shopify read
integration, local LLM integration, prompt conventions, DB schema, UAM) before writing any code, to reuse
rather than duplicate. Must reuse the existing local LLM client if one exists — never add a second AI
provider. Content generation prompt (exact business rules given, preserved verbatim in
`content_actions.py`'s `_PROMPT_TEMPLATE`): decide FAQ vs paragraph format from query intent, answer
directly in the first sentence, never invent product specs/claims, "Insufficient source information to
safely draft this claim" fallback when facts aren't available. Query grouping (several related queries →
one consolidated action) required. Duplicate-action protection required. Human edit must preserve the
original AI draft separately. Regenerate must never silently lose a previous draft. Full AIOS
documentation mandatory (this task's own Section 29-34).
