# Capabilities — 2026-09-19

## Capability — Internal Linking Suggestion Engine (Steps 02-05 + Blog HTML Editor, complete)

**Date:** 2026-09-19 (steps built 2026-09-18, closed/confirmed 09-19)
**Owner:** Dilaksi (built by Kuberan)
**Project:** dm-dashboard, ledsone.co.uk
**Status:** COMPLETE, all 5 steps + an extra Blog HTML Editor, live-verified against real production
data

### Capability

Extends `2026-09-18_ledsone-content-index-step01_capability.md` (the content index this is all
built on) with the full pipeline: deterministic phrase matching finds candidate internal links →
measure per-page link density against a documented threshold → generate prioritized,
human-reviewable suggestions with an Approve/Reject workflow → turn an Approved suggestion into a
tracked handoff task with live re-verification against the real site.

### Reusable safety pattern — the Blog HTML Editor's insertability pre-check

A safe link-insertion preview/editor that **pre-computes whether each suggested insertion is
actually safe before offering it** — live-confirmed to correctly REFUSE an unsafe nested-link
insertion rather than corrupting the page, and live-confirmed 55 of 732 real suggestions are
genuinely not insertable (shown as such, not hidden or forced).

### Real bug found and fixed live

A product_type phrase fan-out caused a 795,275-row explosion during a real scan — found, fixed
same day, and the fix was confirmed via a second live scan producing sane results.

### Originating task

`closure/dilaksi/2026-09-19_dilaksi_internal-linking-suggestion-engine_closure.md`

### Known, documented limitations (not defects — explicitly not guessed/invented)

High/Medium priority will always show 0 because cornerstone-page and "new blog post"
classifications don't exist anywhere in this project yet — not invented to make the feature look
more complete. No publish-status signal for Collections/Blogs (only Products have it). No
content-team role/notification system exists, so handoff assignment is a manual free-text field.

### Reuse

`priority_rules.py` is documented as the single place to wire in a cornerstone-page or new-blog-post
classification if either is ever added to this project — the rest of the pipeline is already built
to use it once it exists.
