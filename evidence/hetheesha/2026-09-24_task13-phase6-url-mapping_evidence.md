# Evidence — Task 13 (Hetheesha) Phase 6: Primary Keyword → URL Mapping

**Date:** 2026-09-24
**Related:** [[2026-09-24_task13-phase5-keyword-clustering_evidence]],
[[2026-09-24_task13-french-keyword-research-source-map]]

## Scope

Mapping DECISIONS as data only. Explicitly NOT done: gap reporting,
cannibalisation reporting, redirects, any Shopify write (URLs, handles,
canonicals, metadata, content, internal links), automatic approval, UI,
Task 13 closure.

## Files (dm-dashboard, `dev-work`; left UNCOMMITTED for coordinator review)

- `backend/app/hetheesha_task13.py` — extended in place (schema, pure
  decision functions, `build_url_mappings`, `_quality_check_mappings`,
  7 endpoints).
- `backend/tests/test_hetheesha_task13_url_mapping.py` — new, 24
  fixture-labelled tests (in-memory only, host `test-fixture.invalid`).

## Mapping rules as implemented

1. **Candidates come only from `hetheesha_kw13_shopify_page_inventory`**
   (1,178 rows: 1,077 ACTIVE + 37 DRAFT products, 64 collections, 0 blogs).
   Nothing is fabricated; the quality check re-verifies every selected and
   candidate URL against the inventory. Inventory was 1.4 h old at build
   time (stale flag at 7 days).
2. **Intent → page type:** TRANSACTIONAL → Collection/Product;
   COMMERCIAL_INVESTIGATION → Collection (or Blog if one existed);
   INFORMATIONAL → Blog only. No Blog rows exist (FR token lacks
   `read_content`), so informational clusters resolve to `NO_SUITABLE_URL`
   instead of being forced onto a product/collection page.
3. **Relevance = labelled tiers, not a numeric score** (spec section 7):
   EXACT (title == primary-keyword tokens) > STRONG (all primary tokens in
   title, ≤2 extra; or title == core-topic tokens) > PARTIAL_GSC (core
   topic in title AND GSC shows the URL for the primary keyword) >
   GSC_ONLY > PARTIAL. Slug/handle is supporting only; a handle sharing no
   word with its own title caps the mapping at NEEDS_REVIEW because page
   content is not in the inventory.
4. **GSC is evidence, source-labelled `google_search_console`:** per-URL
   impressions/clicks/impression-weighted position for the primary keyword
   and the cluster.
5. **AUTO_MAPPED** only when EXACT/STRONG/PARTIAL_GSC, unique winner, valid
   primary keyword (in cluster, has provenance, classification
   AUTO_CLASSIFIED/VALIDATED), cluster not NEEDS_REVIEW, active URL,
   compatible page type, no conflicting mapping. **APPROVED is never set
   automatically** (only the human PATCH can).
6. **CONFLICT:** (a) GSC shows ≥2 distinct URLs with impressions for the
   primary keyword (no threshold — the spec defines none; per-URL numbers
   are stored so Phase 7 can decide); (b) two clusters of the SAME intent
   both select one URL. Different-intent sharing is only annotated
   (`blocking:false`), because Phase 5 intentionally splits by intent.
7. **LLM:** existing local-LLM chain, only for genuinely tied candidates;
   answer validated to 0..N; its suggestion is stored as derived evidence
   and can only yield NEEDS_REVIEW, never AUTO_MAPPED. 2 calls in the real
   run.

## Real results (mapping run 27, cluster run 25 → 83 mappings)

| Status | Count | Notes |
|---|---|---|
| AUTO_MAPPED | 26 | 19 TRANSACTIONAL, 7 COMMERCIAL_INVESTIGATION |
| CONFLICT | 20 | 12 same-intent shared URL, 8 GSC multi-URL |
| NO_SUITABLE_URL | 20 | 19 INFORMATIONAL (no blog inventory), 1 TRANSACTIONAL ("ledysone") |
| NEEDS_REVIEW | 17 | 10 cluster/primary problems, 3 handle≠title, 2 weak match, 2 LLM-assisted ties |
| APPROVED | 0 | correct — human-only |

(Run 26 is an earlier identical-rules build, superseded by run 27, which
added the "GSC URL outside inventory" note; both preserved.)

Real examples:
- `CL-0004 Applique murale` → `/collections/applique-murale`, AUTO_MAPPED —
  title identical to primary keyword; no GSC impressions stored (stated in
  the reason).
- `CL-0011 IP67 Transformateur LED` → `/collections/ip67-transformateur-led`,
  AUTO_MAPPED (an exact-primary title now beats the looser core-topic match
  "Transformateurs LED").
- `CL-0069 ampoule vintage` (commercial) → `/collections/ampoules-e27`,
  AUTO_MAPPED via PARTIAL_GSC: core topic in title + 280 GSC impressions.
- `CL-0058 douille gu10` → an ACTIVE product page, AUTO_MAPPED: 271 GSC
  impressions for that query on that URL and no collection matched.
- `CL-0012 Ampoule` and `CL-0013 Ampoules` → both select
  `/collections/ampoules-b22` → CONFLICT (same intent). This is exactly
  the Phase 5 singular/plural near-duplicate limitation surfacing.
  Similarly plafonniers/plafonnier suspension, support de lampe/support,
  câbles/cable pour lampe, panneaux led/panneau led, connecteurs.
- `CL-0051 abat jour metal` → CONFLICT: GSC shows 2 URLs (a collection with
  798 impressions and a blog article).
- `CL-0077 ledsone` → CONFLICT: 14 URLs (brand query; expected).
- `CL-0029` maps to a collection titled "Lampes Suspendues Modernes &
  Vintage" whose handle is `livraison-gratuite`; `CL-0044` "Ventes flash" →
  `promotion-hebdomadaire` → NEEDS_REVIEW (handle/title contradiction).
- `CL-0067 suspension lustre` (2 collections tied) and `CL-0081 ampoule
  bougie` (5 products tied) → NEEDS_REVIEW; LLM suggestions preserved as
  derived evidence only.
- `CL-0061 quelle hauteur suspension cuisine` → NO_SUITABLE_URL, BUT GSC
  shows a real blog article
  (`/blogs/news/comment-choisir-la-suspension-parfaite-...`) receiving
  impressions. It is not in the inventory (blogs unreadable), so it is
  NOT mapped, and the reason says to verify before treating it as a gap.

`_quality_check_mappings(27)` → `{'mappings_checked': 83, 'passed': True,
'issues': []}` (keyword exists, URL in inventory, page type known,
intent/page-type compatible, primary belongs to cluster, no primary
keyword → 2 URLs, alternatives preserved, no fabricated URL/keyword, GSC
evidence source-labelled, one mapping row per cluster).

## Live API validation (no writes)

PATCH correctly rejected with HTTP 400: fabricated URL, human setting
AUTO_MAPPED, informational → collection, DRAFT product, APPROVE with no
URL, unknown status. GET list/detail/candidates/quality-check verified.
The successful PATCH/approve write path was NOT exercised on production
rows (avoids contaminating research data); it is covered only by its
validation rules, not an end-to-end write test.

## Regression

Phase 5 `_quality_check_clusters(25)` still passes; 144 seeds / 144
classified / 83 clusters / 144 memberships / 1,178 inventory rows
unchanged; 0 APPROVED rows.

## Security

No secrets in code, output or this record. No `.env`, Shopify or
deployment change. LLM host already in use since Phase 4.
