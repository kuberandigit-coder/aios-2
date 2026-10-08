# Capabilities — 2026-09-24

## Capability — French Keyword Research & Page Mapping Pipeline (Task 13)

**Date:** phases built 2026-09-24, finalized 2026-09-25
**Owner:** Hetheesha (built by Kuberan)
**Project:** dm-dashboard, ledsone.fr
**Status:** Implementation Complete — Manual Verification Pending, not deployed, no closure record
yet (explicitly not claimed as COMPLETE)

### Capability

An 8+-phase pipeline turning real French search keywords into a reviewed keyword-to-page map: real
keywords → intent and modifiers → topic clusters → a suggested page per cluster → gap/
cannibalisation detection → human review → Approved Keyword Map. Read-only toward Shopify —
approving a suggestion only records a decision, never writes to Shopify.

### Data sources

Google Search Console (`google_search_console.query_page`, business DB, read-only, last 180 days);
Shopify Admin API for `ledsone_fr` (stored page inventory); the self-hosted local LLM
(Qwen3-Next, Gemini fallback) for intent/modifier/topic/near-duplicate-cluster derivation
(explicitly derived and validated, not asserted as ground truth); PostgreSQL for persistence; a
human reviewer for final approval.

### Important reusable logic

- **One primary keyword → one approved URL**, enforced by both a database unique index AND a
  server-side check on approve — a belt-and-suspenders uniqueness guarantee, not just a UI
  restriction.
- **Review decisions are stored separately, keyed by the normalized primary keyword** — so a weekly
  re-run (which recreates clusters and mappings from scratch) does not lose prior human approvals.
  This is a reusable pattern for any future feature that both (a) periodically regenerates its own
  derived data and (b) needs human decisions on that data to persist across regenerations.

### A deliberate scope decision, not a gap

**Google Keyword Planner was dropped by explicit decision on 2026-09-25** — not implemented, and
explicitly documented as not a dependency. Volume/competition/CPC columns were removed from the
dashboard rather than shown with fabricated or stale data. Dormant code remains in the package
(a keyword_planner.py file, three endpoints, one job step, an empty table) — flagged as removable
later, not hidden.

### Originating tasks

`handover/hetheesha/2026-09-25_task13-phase10-final-handover.md` (final summary); 8 phase-by-phase
evidence/validation/handover sets dated 2026-09-24 (`task13-phase1-audit` through `phase8-
dashboard-ui`) plus phase9/10 dated 2026-09-25.

### Reuse

The "derive with AI, validate, never assert as ground truth" + "one keyword → one URL, DB-enforced"
+ "review decisions survive regeneration via a stable natural key" patterns are all reusable for
any future keyword/content-mapping feature on this or another store.
