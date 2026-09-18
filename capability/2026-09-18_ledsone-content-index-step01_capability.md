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
