# Validation — Live Deploy vs. Repo Sync Bug + Permanent Fix (2026-08-14)

**Purpose:** Validation record for `evidence/digital-marketing-member-pages/2026-08-14_live-deploy-vs-repo-sync-bug-and-permanent-fix.md`.

## Checks performed
- Confirmed pre-fix: `curl https://dm-dashboard.vintageinterior.co.uk/pages/kuberan.html` was missing 4 commits' worth of sidebar changes despite `check-repo-sync.js` reporting FULLY IN SYNC.
- Confirmed the Vercel project's GitHub connection via `vercel git connect https://github.com/digitalmarketing69140951-sys/Staff-requirements.git` → "already connected" (ruled out "no auto-deploy configured" as the cause).
- Ran `vercel --prod --yes` from a clean, up-to-date `staff-req-sync3` worktree; confirmed `git status` was clean and matched the last pushed commit beforehand.
- Post-fix: curl against the live domain showed all expected strings (EOD Admin, Performance Analysis, Blog Tool, mg-embed) present.
- Ran `scripts/check-live-deploy.js` against production: reported OK on all 4 canaries, "LIVE SITE MATCHES LOCAL CODE."
- Confirmed the script correctly reads live content over HTTPS and compares against the local Staff-requirements worktree file content (not just the aios-2 copy).

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** Use `check-live-deploy.js` after every future push to `Staff-requirements` touching `api/`/`pages/` files. Root cause of *who* triggers the stray manual deploys remains unconfirmed — flagged as an open question for Kuberan/Piranav, not something resolvable from the Vercel CLI alone.
