# Vercel Notes — Dilaksi GA4 SEO Report (NOT DEPLOYED)

**Title:** Deployment notes for dilaksi-ga4-seo-organic-last-30-days.html
**Purpose:** Document how to deploy when approved. **No deployment has been performed.**
**Requirement source:** Google Sheet gid=2139905564 · **Team member:** Dilaksi · **Team:** SEO · **Date:** 2026-07-02

## Deployment plan (when explicitly approved)
- The report is a single static HTML file with no build step, no JS, no external dependencies — deployable as-is.
- Option 1 (simplest): drop the file into an existing Vercel static project as `dilaksi/ga4-seo-organic.html`.
- Option 2: `vercel deploy` from a folder containing only this file + `vercel.json` (static).
- No environment variables, no server, no database connection needed at runtime (data is baked in at generation time).
- Refresh model: re-run the reusable prompt (prompts/dilaksi/dilaksi-ga4-seo-html-report-prompt.md) to regenerate the file, then redeploy.

## Considerations before deploy
- Data contains revenue figures — confirm whether the URL must be access-protected before making public.
- Report is a snapshot (generated 2026-07-02, GA4 window ending 2026-06-27); stale after next export run.

**PostgreSQL source checked:** google_search_console.ga4_organic_landing_page_revenue, gsc_web_query_page (read-only)
**Files created/modified:** this note only (no deploy)
**Evidence path:** evidence/dilaksi/dilaksi-ga4-seo-postgresql-evidence.md
**Validation result:** report PASS (see validation file); deploy not validated (not performed)
**Owner/reviewer:** Kuberan · **Status:** ON HOLD — awaiting explicit deploy approval
**Known limits:** static snapshot; engagement metrics N/A; 90-day window.
**Next step:** Get approval → deploy → record URL here.
**PASS/FAIL rule:** PASS if deploy happens only after explicit approval and URL is recorded here; FAIL if deployed without approval.
