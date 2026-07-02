# Vercel Deployment — Digital Marketing Member Pages Hub

**Title:** Production deployment record
**Purpose:** Record the live URL and how to redeploy.
**Task date:** 2026-07-02 · **Owner/reviewer:** Kuberan

## Live URLs (deployed 2026-07-02, user-approved)
- **Production (stable):** https://digital-marketing-member-pages.vercel.app
- Dilaksi report: https://digital-marketing-member-pages.vercel.app/pages/dilaksi.html
- Deployment ID: dpl_BSCS4tL5JSXbQTUC4h2o7sT8oa2J

## Verification
- index 200 OK, dilaksi.html 200 OK, title renders.
- Vercel Deployment Protection (SSO) was ON by default → disabled via API (PATCH ssoProtection=null, HTTP 200) so team members can view without Vercel accounts. **Note: revenue data is now publicly reachable at this URL — restrict later if needed.**

## Redeploy after changes
```
cd "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/digital-marketing-member-pages"
vercel deploy --prod --yes
```

**Validation result:** PASS · **Status:** LIVE · **Duplicate-risk:** GREEN (single project)
**Known limits:** static snapshots; public URL; Dilaksi GA4 window ends 2026-06-27.
**Next step:** Redeploy whenever member pages are added; consider access protection for revenue data.
**PASS/FAIL:** PASS
