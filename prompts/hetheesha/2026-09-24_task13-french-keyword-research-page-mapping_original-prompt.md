# Task 13 — French Keyword Research & Page Mapping — Original Requirement (Phase 1 scope)

**Date:** 2026-09-24
**Owner:** Hetheesha
**Project:** DM Dashboard
**Target site:** ledsone.fr
**Phase:** Phase 1 ONLY — Audit + Architecture Discovery (no implementation)

## Business requirement (verbatim intent, condensed)

Intended end-to-end workflow:

```
Google Keyword Planner + Google Search Console (ledsone.fr) + Shopify Admin API (ledsone.fr)
  -> French Keyword Dataset
  -> Intent + Modifier Classification
  -> Keyword Clustering
  -> Primary Keyword -> URL Mapping
  -> Gap Detection
  -> Cannibalisation Detection
  -> Approved Keyword Map
```

Six build steps (Step 01–06) were specified for a future phase:
1. Build a French seed keyword list for LEDSone.fr from real French shopper
   terminology (not literal UK-keyword translation) — categories like
   suspensions, appliques murales, plafonniers, lustres, lampes de table,
   spots encastrables, dalles LED, rubans LED, ampoules LED, éclairage
   extérieur, plus whatever else real ledsone.fr data surfaces.
2. Collect keyword metrics — Google Keyword Planner (France, French
   language: keyword, monthly search volume, competition, CPC) combined
   with actual GSC queries for ledsone.fr. Explicit instruction: Google Ads
   "competition" is NOT SEO difficulty/KD — must never be mislabeled.
3. Classify Transactional / Commercial investigation / Informational, plus
   modifiers (room, size, colour, E27/GU10, IP rating, colour temperature,
   style, material, location/use case, etc., as actually found in data).
4. Cluster keywords: each cluster -> one primary keyword, secondary
   keywords, intent, representative volume, one mapped URL (one primary
   keyword -> one primary URL, to reduce cannibalisation).
5. Find unmapped keyword opportunities, new page opportunities, and
   cannibalisation (two ledsone.fr URLs ranking for the same primary
   keyword).
6. Produce an approved keyword map as input for downstream tasks
   (Task 06, 07, 09, 10, 11, 19, 23 — not modified in this phase).

### Priority rules (must be reproduced exactly, not reinvented)

- **HIGH** — Transactional cluster, monthly search volume >= 600, no mapped page.
- **HIGH** — Two ledsone.fr URLs rank for the same primary keyword.
- **MEDIUM** — Informational cluster with no guide/blog page.
- **LOW** — Cluster volume < 100.
- **NO ACTION** — Keyword already mapped AND mapped page ranking Top 3.

## Phase 1 scope (what THIS phase covers)

Read-only audit and architecture discovery only:
- Inspect existing DM Dashboard backend/frontend for reusable capability.
- Verify whether a real Google Keyword Planner integration exists (vs.
  Google Ads campaign-performance data, which is NOT the same thing).
- Verify Google Search Console coverage for ledsone.fr.
- Verify Shopify Admin API coverage for ledsone.fr (read-only).
- Inspect Postgres schema conventions, local LLM/AI utility patterns, the
  UAM/taskRegistry registration path, and reusable frontend components.
- Produce a source map, gap report, proposed DB model/API/UI structure
  (proposed only, not built), and a Phase 2–10 implementation plan.
- Update AIOS documentation per the mandatory auto-update rules.

Explicitly OUT of scope for Phase 1: building the dashboard UI, building the
keyword research workflow, creating DB migrations (beyond harmless
inspection), modifying production functionality, inventing APIs/credentials/
data/endpoints/metrics.

See the companion evidence file for what was actually found:
[[2026-09-24_task13-phase1-audit_evidence]] and the handover record
[[2026-09-24_task13-phase1-audit_handover]].
