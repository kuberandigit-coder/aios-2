# Capability — LEDSone Content Index (Step 01 of Internal Linking Suggestion Engine)

Date: 2026-09-18

## What this capability provides

A reusable, persisted index of LEDSone UK's Product and Collection pages (URL, title, content
text/html, availability flags), refreshable on demand via `POST /api/dev/internal-linking/content-index/refresh`
and readable via `GET /api/dev/internal-linking/content-index`. Backed by
`public.internal_linking_content_index` in the existing Postgres database.

This is the foundation the later Internal Linking steps (02–05, not yet built) will read from — future
work should query this table rather than re-fetching Shopify data independently.

## Explicitly NOT included in this capability

Blog content indexing (no authoritative source exists — see this task's source-map), keyword
opportunity detection, link density analysis, or suggestion generation. Adding any of these is future
work under Steps 02–05, not an extension of this capability record.

## Checked before creating

Searched `capability/` for existing "internal linking", "content index", or "Dilaksi content" records —
none found (closest matches were `2026-09-17_gsc-404-url-monitor_capability.md` and
`2026-09-17_broken-link-404-monitor_capability.md`, both unrelated 404-monitoring capabilities). No
duplicate capability record created.

## UPDATE (2026-09-18, later) — Step 02 expands this capability

This capability now also includes a deterministic internal-link-opportunity detector
(`link_opportunities.py`, tables `internal_linking_opportunities` / `internal_linking_opportunity_scans`)
built directly on top of the Content Index above — no new capability record was created since this is a
direct expansion of the same one. It matches page titles/product types as anchor phrases via tokenized
n-gram dictionary lookups (not AI/semantic similarity, not a brute-force regex — see this task's evidence
doc for the performance rationale), checks existing links, excludes self-links, and deduplicates results.
Future steps (04-05: ranking, handoff) should build on this same capability rather than re-indexing or
re-scanning independently.

## UPDATE (2026-09-18, later) — Step 03 further expands this capability

Added a link-density measurement capability (`link_density.py`, `density_rules.py`, table
`internal_linking_density`) — per-page total/unique internal link counts, per-type breakdown, self-link
tracking, and a single documented threshold-based status (not a priority/ranking engine). Still a direct
expansion of the same Content Index capability, no separate capability record created. A real bug in the
shared link-parsing code (external links mis-counted as internal) was found and fixed as part of this
work, improving Step 02's accuracy too.

## UPDATE (2026-09-18, later) — Step 04 further expands this capability

Added a suggestion-generation and priority-classification capability (`suggestions.py`,
`priority_rules.py`, table `internal_linking_suggestions`) -- turns Step 02/03's outputs into reviewable,
prioritized suggestions with a persistent Approve/Reject/Keep-for-Review workflow. Still a direct
expansion of the same Content Index capability chain, no separate capability record created. Documented
limitation carried into this expansion: High/Medium priority requires cornerstone and new-blog
classifications that don't exist in this project, so those tiers are currently unreachable by design --
whoever builds Step 05 (handoff) should be aware every suggestion today is Low or No Action.
