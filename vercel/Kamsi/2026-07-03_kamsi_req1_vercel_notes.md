# Vercel Placement Recommendation — Kamsi Requirement 1

**Title:** Kamsi Req 1 Vercel notes · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan · **Status:** NOT deployed (approval required)
**Purpose:** Where and how this report should go live.
**Requirement Source:** Kamsi via Kuberan prompt 2026-07-03. **Business Question:** slow-movers needing SEO attention.

## Recommendation
- **Project:** existing `digital-marketing-member-pages` (digitalmarketing69140951-sys-projects) — same as all member reports; no new project needed.
- **Path:** `/pages/kamsi-req1-slow-moving-products.html` (file already in place in the project folder).
- **Deploy command (after Kuberan approval):** `cd "C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages"` → `vercel deploy --prod --yes` → verify the URL returns 200 with 4,793 rows.
- **Shared repo:** subtree-push `reports/digital-marketing-member-pages` to `digitalmarketing69140951-sys/Staff-requirements` main.
- ⚠️ Vercel↔GitHub auto-deploy is disconnected (hung-build incident 2026-07-03); CLI deploy is the working path until the GitHub App is authorized in the Vercel dashboard.

**Files Created / Evidence / Validation:** see `evidence/Kamsi/` + `validation/Kamsi/` (2026-07-03).
**Known Limitations:** page is static; data refresh requires rerunning the builder.
**Next Steps:** Kuberan approval → deploy → live verification note appended here.
**PASS/FAIL:** PASS (recommendation ready; deployment intentionally not performed)

## Deployment record (2026-07-03)
Kuberan approved ("deploy kamsi"). Deployed dpl_7B5LMGtc7kmZerrb6hfaSoK4cqH2 via CLI → https://digital-marketing-member-pages.vercel.app/pages/kamsi-req1-slow-moving-products.html
Live verification: HTTP 200, 4,793 rows, title present; kamsi.html links R1; Dilaksi Req3 page unaffected (200). Status: LIVE · PASS.
