# Capabilities — 2026-09-15

The busiest single day found in this entire AIOS history (40 commits).

## Capability — Rate-Limited, Audited Shopify Write Pattern (Alt Text Keyword Finder)

**Date:** 2026-09-15
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Live, then its own write capability intentionally disabled by request (see below)

### Capability

A reusable pattern for giving a dev tool **write** access to Shopify (here: bulk alt-text updates)
safely: a narrowly-scoped, dedicated Shopify app (not the general-purpose admin token), a
50-product-per-day-per-user enforced limit, and a full Update History audit log (who/what/when,
showing the exact image and before/after value changed) — not a silent bulk write.

### Explicitly disabled by request, twice (not a bug — a deliberate decision)

First the "Update in Shopify" button was disabled per request; then the **write API itself** was
disabled (not just the button) — a second, stronger step showing the decision was to fully remove
write capability, not just hide the UI control for it. Document this before ever re-enabling Shopify
writes from this feature without re-confirming the decision still holds.

### Reusable AI-generation iteration (several same-day reversals before landing)

Per-image AI alt text generation went through: Gemini JSON-mode fix → replaced with pure Python (no
external API) → that revert itself reverted → switched to the self-hosted local LLM → falls back to
Gemini when the local LLM is unreachable → moved to background, one product at a time (fixes a 504)
→ capped to 50 products per visit with auto-continue. **Final shape: local LLM first, Gemini
fallback, background generation, permanent cache, auto-generate only for genuinely missing
images.** This exact fallback chain (local LLM → Gemini, background + cached) is the same shape
worth reusing for any future per-item AI generation feature prone to timeouts at scale.

### Data-quality gotchas found and fixed

A "2-core cable" bug incorrectly selected "3 Core" as its keyword (fixed); identical-alt-text bug
(positional fallback + duplicate detection); flags images whose alt text just duplicates the
product title.

### Originating task

`closure/dm-dashboard/2026-09-15_alt-text-keyword-finder-and-dev-task-log.md`

---

## Capability — Dev Task Log (manual task/benefit tracker)

### Capability

A manual-entry page (date/user/task/benefit) living in the existing `public` schema (not a new
dedicated schema — corrected same day), with User as a dropdown sourced from the real users table,
CSV export, and filter-by-user.

### Reuse

A simple, reusable "log what was done and why" pattern distinct from the earlier, removed
git-history-driven "My Dev Tasks" tracker (see Note below) — manual entry rather than automatic
git-derived.

### Note — 2 more features removed this same day

"My Dev Tasks" (the git-history-driven tracker built 2026-09-08) and "Competitor Lens Search"
(built 2026-09-10, see `2026-09-10_capability.md`) were both **removed entirely** this day —
continuing the build-then-remove pattern already noted on 2026-09-07/09-10. A production hotfix
(a broken `seo_serp_tracker` import) was also needed same day, indicating a deploy had broken
production and was fixed same-day.

### Originating task

`closure/dm-dashboard/2026-09-15_alt-text-keyword-finder-and-dev-task-log.md`
