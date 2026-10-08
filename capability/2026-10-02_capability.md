# Capabilities — 2026-10-02

## Capability — Blog Optimization: Multi-System Reuse Workflow (detection → QA → publish)

**Date:** 2026-10-02
**Owner:** Dilaksi (built by Kuberan)
**Project:** dm-dashboard
**Status:** Done, pushed to `dev-work`

### Capability

A click-decline-to-optimization workflow (detection → analysis → competitor gap → cause →
optimization → QA → publish → Search Console → before/after) built almost entirely by **reusing 4
separate existing systems wholesale** rather than building anything new for them:

- Blog-type URL classification reused directly from `search_intent_page_action`'s
  `classify_page_type` (not duplicated).
- Shopify blog-content fetching reused directly from `kamsi_blog_title_finder`'s existing
  article-resolve logic.
- Competitor-gap checking reused directly from `content_gap`'s existing SerpAPI search +
  page-comparison pipeline — with its own cooldown/quota-safety lock layered on top so it can't
  exhaust the shared SerpAPI account.
- Deterministic cause classification kept strictly separate from an optional AI-written
  recommendation, with the API response structured so the frontend can **never present the AI
  text as a measured fact** — a reusable principle for any feature mixing measured data with an
  LLM's commentary on it.

### Originating task

`closure/dm-dashboard/2026-10-02_blog-optimization-dev-task_closure.md`

### Reuse

The overall shape — detect from real data, reuse every adjacent system instead of rebuilding, keep
AI commentary visibly separate from measured facts — is the template for any future "turn a metric
decline into an actionable workflow" dev task on this project.

---

## Capability — Sidebar Registration Dedup (3-way duplication fixed)

### Capability

Found that dev-task sidebar registration had been maintained in **3 separate, hand-maintained
places** (the grant-list/access-control file, and two separate sidebar files) — two new tasks
(this one and Search Intent → Page Action) were correctly registered for access-granting but never
actually appeared in the nav, because of this 3-way duplication. Fixed both missing entries, then
**deduplicated the underlying 3-way-duplication problem into one shared registry.**

### Originating task

Same closure doc as above (`closure/dm-dashboard/2026-10-02_blog-optimization-dev-task_closure.md`).

### Related

`2026-10-06_capability.md` has a closely related finding (`SCHEDULED_SNAPSHOT_TABS`/`LABELS` vs.
the actual sidebar array in `DevLayout.jsx`) — worth checking both together if sidebar
registration confusion recurs.

### Reuse

Register any future dev task in the single shared registry this fix created, not in multiple
hand-maintained files — that's exactly the failure mode this fix closed.
