# Capabilities — 2026-09-21

## Capability — Collection Page Thin-Content Detector, Level 1 (audit → priority → backlog)

**Date:** 2026-09-21
**Owner:** Dilaksi (built by Kuberan)
**Project:** dm-dashboard, ledsone.co.uk
**Status:** COMPLETE (Level 1 only — 23/23 in-scope validation checks PASS), not yet useful to
staff until 2 config thresholds are set

### Capability

An audit → priority → backlog pipeline for detecting thin-content collection pages, live-tested
against 490 real Shopify collections and 1,114 real GSC-matched URLs.

### Reusable convention — never fabricate a priority when its input is unset

Both `min_word_count` and `high_traffic_clicks` thresholds must be set by the user via a Config
tab; until then, **every collection reads priority `NOT CONFIGURED` by design** — confirmed
handled correctly for both unset thresholds in the live test, never silently defaulted to a guessed
number.

### Originating task

`closure/dilaksi/2026-09-21_dilaksi_collection-thin-content-detector-level1_closure.md`

### Reuse

The "NOT CONFIGURED until the user sets a real threshold, never a guessed default" convention is
the same pattern already established elsewhere in this project (e.g. Task 13's "not implemented,
not guessed" Google Keyword Planner decision) — worth applying to any future feature whose priority
logic depends on a business-specific threshold nobody has set yet.

### Explicit scope note

This closes Level 1 only. Level 2 (content gap/brief/FAQ suggestion generation) and Level 3
(preview, human approval, manual implementation, post-implementation verification) are explicitly
NOT implemented — not silently deferred, documented as out of scope for this closure.

### Related

`capability/2026-09-22_ai-faq-schema-generation-pattern_capability.md`'s FAQ generation, which this
Level 1 detector does not yet produce (that's Level 2, if requested).
