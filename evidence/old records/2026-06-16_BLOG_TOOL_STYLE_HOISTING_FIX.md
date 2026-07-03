# Blog Builder — Hoist Per-Block `<style>` Tags Out of Article Body

| | |
|---|---|
| **Project** | Blog Builder Tool (`index.html`) |
| **Repo** | blog-builder (origin/master) |
| **Category** | Bug Fix — Rendering / Shopify compatibility |
| **Date** | 16/06/2026 |
| **Status** | Completed & pushed |

## Objective
Fix a large vertical gap that appeared **above a 2-image section** when Blog Builder HTML was rendered inside Shopify, while the gap did **not** appear in the Blog Builder preview.

## Investigation (root cause)
Discovery-only pass first (no fixes), then implementation.

- The generated HTML injected a raw `<style>` element **into the article body, immediately above the image `.section`** (e.g. line 8303 for the 2-image / pair case).
- Shopify pipes `article.content` through the `newline_to_br` Liquid filter (documented at `index.html:8769`) and its parser can split the article wrapper on mid-content `<style>` tags (documented at `index.html:5201-5204`).
- This interaction inserted a phantom node above the image, which also defeated the `.section > .pair:first-child{margin-top:0}` reset (`index.html:7780`), re-exposing `.pair`'s `margin-top:14px` — producing whitespace absent in the self-contained preview (no `newline_to_br`; `<style>` is `display:none`).

## Root Cause
Mid-content `<style>` nodes embedded between content blocks in the exported HTML.

## Files Changed
- `index.html` — 6 sites converted from inline `h += '<style>…'` to `_inlineStylesCollector.push('<style>…')`:
  - `section` → single image (line ~8059)
  - `imageonly` → single (~8294), **pair (~8303 — the reported 2-image case)**, triple (~8314)
  - `imgtxt` (~8344) and `imglist` (~8367)
- Updated a stale comment that wrongly claimed the collector "is never appended to the output."

## Changes Made
All per-block mobile media queries are now routed through the existing `_inlineStylesCollector`, which `_extraCSS` appends into the single top-level `<style>` block — in **both** preview and export paths. No `<style>` element remains in the article body.

## Validation
- Traced both render paths: `buildBody()` populates the collector **before** `_extraCSS` is read and embedded — confirmed in export (`8761→8762→8768`) and preview (`8605→8606→8609`).
- Grep confirms zero remaining `h += '<style>'` injections.
- Media queries unchanged in effect (global ID selectors, now in the head `<style>`).
- Browser preview not run (per request); verification by code-path tracing + grep.

## Outcome
With no mid-content `<style>`, the image `.section` has no preceding node, so `.section > .pair:first-child{margin-top:0}` applies in Shopify exactly as in preview — the gap is removed. Same fix prevents the equivalent gap on `imgtxt` and `imglist` blocks.

## Push
- Commit `f839a77` pushed to blog-builder `origin/master` (rebased cleanly onto 6 remote housekeeping-delete commits; no force-push).

## Future Considerations
- Confirm against the live Shopify-rendered DOM on the next export (couldn't inspect it during diagnosis).
- Optional hardening: change `.pair:first-child` reset to unconditional `.section > .pair{margin-top:0}`.
