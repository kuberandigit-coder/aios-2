# Capability — Automated SEO Metadata Audit and Traffic-Based Prioritization

**Date:** 2026-09-16
**Owner:** Kuberan
**Staff/Requirement:** Dilaksi Requirement 07 (Meta Title & Description Audit)
**Store/Project:** dm-dashboard / ledsone.co.uk (UK)
**Status:** Completed (implementation), pending push/deploy — see closure record

## Capability
Given a live Shopify catalog and a GA4 property, automatically produce a
prioritized SEO metadata rewrite backlog: every page's current meta
title/description is checked for missing/duplicate/over-length issues,
cross-referenced with real (never fabricated) GA4 traffic, and ranked by
a documented, explicit priority rule set — without ever auto-generating
or publishing the replacement metadata itself (audit + prioritization
only, by design).

## What Was Implemented
1. Whole-catalog, metadata-only Shopify fetch (`products`/`collections`
   GraphQL, ACTIVE-only, `seo.title`/`seo.description`) — lighter and
   faster than any existing per-product-detail fetch in this codebase,
   since it pulls only the handful of fields this audit needs.
2. Missing / duplicate (cross-URL, blank-safe, self-comparison-safe) /
   length (exact >60 / >150 char) detection, pure Python, no AI.
3. GA4 traffic lookup by normalized URL path, with an explicit,
   never-silent "No GA4 data" state distinct from a real zero.
4. A new, explicit, query-overridable high-traffic threshold (this
   codebase had no existing numeric traffic-tier cutoff to reuse).
5. A small, fully documented 4-rule priority ladder (HIGH/MEDIUM/LOW/NO
   ACTION) that always resolves multi-issue pages to one highest
   applicable priority, never an undocumented score.
6. Non-blocking background-job pattern (matches this app's established
   convention) so a full-catalog scan never risks a proxy timeout, with
   a single-row JSONB snapshot for instant re-reads between runs.

## Technical Knowledge
- A metadata-only audit over an entire catalog should use its OWN
  lightweight Shopify query rather than reusing a heavier, per-product-
  detail fetch built for a different feature (variants/images/metafields
  add real latency at catalog scale for data never used here).
- "High traffic" is not a concept this codebase had standardized
  anywhere — any future feature needing a traffic tier should check for
  (and ideally converge on) this requirement's
  `HIGH_TRAFFIC_SESSIONS_THRESHOLD_DEFAULT` pattern (explicit, query-
  overridable, always echoed in the API response) rather than inventing
  another one silently.
- Duplicate-metadata detection must explicitly exclude blank/null values
  from grouping and must exclude a page from its own duplicate list —
  both are easy off-by-one mistakes that silently invent false positives
  if skipped.

## Important Rules / Logic
- Priority rule order (highest wins): missing+high-traffic → HIGH;
  missing+low/no-GA4-data → MEDIUM; duplicate → MEDIUM; length-only →
  LOW; clean → NO ACTION.
- GA4 unavailability (service-account not configured, or a genuinely
  unmatched path) must degrade to an explicit "No GA4 data" state, never
  a fabricated zero or a silently-dropped row.
- This capability's scope hard-stops at the prioritized backlog — no
  replacement metadata generation, no Shopify writes, by explicit design
  (kept audit-only even though the codebase already has an AI-generation
  pattern elsewhere in this session's work, since that pattern belongs
  to a different, explicitly-scoped feature).

## Files / Components
- `backend/app/dilaksi_meta_audit.py`
- `frontend/src/dilaksi/pages/MetaTitleDescriptionAudit.jsx`

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone_uk`), GA4 Data API (property
`408110563`, organic search only), this app's own Postgres.

## Validation
See `validation/dilaksi/2026-09-16_dilaksi_req07_meta_title_description_audit_validation.md` — live-verified against real data (5,533 pages).

## Reuse
This exact pipeline shape (whole-catalog lightweight Shopify metadata
fetch → rule-based issue detection → GA4 traffic cross-reference →
explicit priority ladder → backlog) is directly reusable for any future
"audit X across the whole catalog, prioritize by real traffic" request —
e.g. an image-alt-text audit (a similar, already-built feature exists
elsewhere in this session as Alt Text Optimization, though built
independently before this capability was written down) or a structured-
data/schema-markup audit. Reuse the traffic-threshold and priority-
ladder pattern rather than re-deriving one per feature.

## Evidence
`evidence/dilaksi/2026-09-16_dilaksi_req07_meta_title_description_audit_evidence.md`

## Limitations
The priority ladder and traffic threshold are specific business rules
approved for THIS requirement (Dilaksi Req07) — a future reuse should
confirm with the relevant stakeholder whether the same threshold/rule
values apply, rather than assuming they transfer unchanged.
