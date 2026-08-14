# Closure — Live Deploy vs. Repo Sync Bug + Permanent Fix (2026-08-14)

**Purpose:** Closure record for `evidence/digital-marketing-member-pages/2026-08-14_live-deploy-vs-repo-sync-bug-and-permanent-fix.md`.

## Outcome
Live site manually redeployed and confirmed correct — twice, the second time correcting a regression the first redeploy itself caused (silently reverted Piranav's uncommitted Staff ID Performance tabs). Both the missing kuberan/piranav sidebar content and the reverted Staff ID Performance tabs are now committed to git on both repos and live in production. Permanent detection tool (`scripts/check-live-deploy.js`) built, tested, extended with 3 more canaries, and proven working. Standing memory rewritten to explicitly cover both directions of the mismatch (live stale vs. live ahead of git).

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** Ask Piranav to commit+push any feature he deploys manually via `vercel --prod`, so uncommitted live features stop existing as a category. Until then, run `check-live-deploy.js` after every push, and before redeploying "known-good" code over a live mismatch, check whether production currently has content git doesn't.
