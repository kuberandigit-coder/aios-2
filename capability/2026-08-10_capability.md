# Capabilities — 2026-08-10

## Capability — Target Achievement / YoY Growth Metric Definition

**Date:** 2026-08-10
**Owner:** Kuberan (Muguntha's dashboard)
**Project:** digital-marketing-member-pages
**Status:** Live, applied across all 5 built members

### Capability

A precise, reusable definition for two related-but-distinct metrics that are easy to conflate:

- **Target Achievement** = 2026 Net ÷ (2025 Net × 1.30) — i.e. performance against a 30%
  year-on-year growth target, using **Net** (Sales − Cost), not raw Sales.
- **YoY Growth %** = (2026 Net − 2025 Net) ÷ 2025 Net — the raw percentage change, shown as a
  separate, non-target-relative figure.

### Why this needed 3 iterations the same day

1. First built against ROAS/ad-spend-efficiency — corrected once the user clarified they actually
   wanted a sales-growth target, not an efficiency ratio.
2. The resulting Target Achievement ratio was being misread by the user as a raw growth figure —
   fixed by adding the separate YoY Growth % column so both numbers are visible without confusion.
3. The basis was corrected from raw Sales to Net (Sales − Cost) for both figures, same day.

### Originating task

`evidence/muguntha/2026-08-10_target-achievement-redefinition-yoy-growth.md`

### Reuse

Similar in kind to `2026-07-24_capability.md`'s "organic sales" rule definition — a precise,
written business-rule definition that prevents the same ambiguity from being re-litigated for
every new staff member added to this dashboard. Any new member added to `muguntha.html` should use
this exact Target Achievement/YoY Growth formula pair, not a fresh reinterpretation.
