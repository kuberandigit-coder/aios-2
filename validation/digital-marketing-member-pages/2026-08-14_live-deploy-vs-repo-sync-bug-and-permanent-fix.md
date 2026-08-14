# Validation — Live Deploy vs. Repo Sync Bug + Permanent Fix (2026-08-14)

**Purpose:** Validation record for `evidence/digital-marketing-member-pages/2026-08-14_live-deploy-vs-repo-sync-bug-and-permanent-fix.md`.

## Checks performed
- Confirmed pre-fix: `curl https://dm-dashboard.vintageinterior.co.uk/pages/kuberan.html` was missing 4 commits' worth of sidebar changes despite `check-repo-sync.js` reporting FULLY IN SYNC.
- Confirmed the Vercel project's GitHub connection via `vercel git connect https://github.com/digitalmarketing69140951-sys/Staff-requirements.git` → "already connected" (ruled out "no auto-deploy configured" as the cause).
- Ran `vercel --prod --yes` from a clean, up-to-date `staff-req-sync3` worktree; confirmed `git status` was clean and matched the last pushed commit beforehand.
- Post-fix: curl against the live domain showed all expected strings (EOD Admin, Performance Analysis, Blog Tool, mg-embed) present.
- Ran `scripts/check-live-deploy.js` against production: reported OK on all 4 canaries, "LIVE SITE MATCHES LOCAL CODE."
- Confirmed the script correctly reads live content over HTTPS and compares against the local Staff-requirements worktree file content (not just the aios-2 copy).

**Status:** PASS (first pass — see correction checks below)

## Correction checks — same day, later in session
- Confirmed the first fix caused a regression: `curl` against 3+ historical deployment URLs (e.g. `https://digital-marketing-member-pages-dgfzu7kw3.vercel.app/pages/staff-id-performance.html`) showed a 5-tab version existed live that the just-redeployed git-tracked version (2 tabs) did not have.
- Used `vercel api /v6/deployments/<id>/files` (with `MSYS_NO_PATHCONV=1` to avoid Git Bash mangling the leading `/`) to confirm the fuller version's file tree, then fetched both `api/staff-id-performance.js` and `pages/staff-id-performance.html` via `/v7/deployments/<id>/files/<uid>`, base64-decoded.
- Ran `node --check` on the recovered `api/staff-id-performance.js` — passed.
- Diffed `STAFF_IDS` object and `ALLOWED_STAFF_KEYS` guard between recovered and local versions — structurally consistent, confirming the recovered file is a superset, not a conflicting rewrite.
- Committed recovered files to both repos, re-ran `check-repo-sync.js` — FULLY IN SYNC.
- Redeployed via `vercel --prod --yes`; curl confirmed all 5 `data-staff` tabs (kamsi, dilaksi, jackson, sajeepan, sonya) present live.
- Re-ran `check-live-deploy.js` (now with 3 added canaries for this feature) — all OK, including after the final docs-only push that followed.

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** Use `check-live-deploy.js` after every future push to `Staff-requirements` touching `api/`/`pages/` files. Root cause of the stray manual deploys is now confirmed (Piranav deploying features live without always committing them) — the technical mitigation is in place for this specific feature; the process ask (commit before/after manual deploys) is with Kuberan to raise with Piranav.
