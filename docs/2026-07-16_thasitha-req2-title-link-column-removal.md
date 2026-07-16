# 2026-07-16 — Thasitha Requirement 2: Title-as-link, Link column removed

**Purpose:** User asked to drop the separate "Link" column from R2 (PMax Product Zero-Performance) and instead make the Product Title clickable as the product link.

**What changed:** `reports/digital-marketing-member-pages/pages/thasitha.html` — R2 table header and row-render (`renderR2()`) updated; title `<td>` now wraps in `<a>` when a link exists, header/column count reduced by one. R1/R3 untouched.

**Evidence:** [[2026-07-16_requirement-2-title-link-column-removal-evidence]]
**Validation:** [[2026-07-16_requirement-2-title-link-column-removal-validation]] — PASS
**Closure:** [[2026-07-16_requirement-2-title-link-column-removal-closure]]

**Status:** Deployed to production.
- Commit: `a1ddcef`
- Vercel deployment: `dpl_6P9UqXUqdx2wWoAipaoo12xFEZ6y` (READY, production)

**Reviewer:** AIOS (self-validated, no live browser check yet)
**Next step:** Optional visual spot-check on live URL.
