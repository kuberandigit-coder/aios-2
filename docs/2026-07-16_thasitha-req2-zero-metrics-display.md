# 2026-07-16 — Thasitha Requirement 2: Zero-denominator metrics show 0.00/€0.00, not N/A

**Purpose:** User asked why CTR/Avg CPC/Conv. Rate/ROAS showed N/A for zero-traffic products, then requested simpler visible values instead of N/A (after confirming Google Ads' own UI shows "--" in the same case, so it wasn't a bug).

**What changed:** `reports/digital-marketing-member-pages/pages/thasitha.html` — `renderR2()` row template now renders `0.00%`/`€0.00` in place of the N/A badge for these four metrics when their denominator is zero. Underlying calc logic unchanged, R1/R3 untouched.

**Evidence:** [[2026-07-16_requirement-2-zero-metrics-display-evidence]]
**Validation:** [[2026-07-16_requirement-2-zero-metrics-display-validation]] — PASS
**Closure:** [[2026-07-16_requirement-2-zero-metrics-display-closure]]

**Status:** Deployed to production.
- Commit: `52e9540`
- Vercel deployment: `digital-marketing-member-pages-rn2l5lajp.vercel.app` (READY, production)

**Reviewer:** AIOS (self-validated)
**Next step:** None expected unless user wants the same convention applied to R3.
