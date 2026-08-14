# Evidence — Live Deploy vs. Repo Sync Bug + Permanent Fix (2026-08-14)

**Purpose:** Record of a new, more severe bug class discovered while adding sidebar links for kuberan/piranav — "code correct on GitHub AND confirmed in-sync between repos, but the live production site is still wrong."

## The bug
User reported the kuberan/piranav sidebar was missing all the day's new items (EOD Tool, Blog Tool, Performance, 2026 New Listings, EOD Admin, section grouping). At that point 4 separate commits had already been pushed to `Staff-requirements`, and `scripts/check-repo-sync.js` reported "FULLY IN SYNC" every time. The code was correct on GitHub. The live site was not.

## Root cause
`vercel git connect` confirmed the `digital-marketing-member-pages` Vercel project IS connected to the `Staff-requirements` GitHub repo (auto-deploy on push). However, a manual `vercel --prod` run from *any* local checkout — however stale — immediately re-aliases the production domain to whatever it just built, with no regard for whether that content is older than the current git-triggered deployment, no error, and no trace in `git log`. `check-repo-sync.js` cannot catch this: it only ever compares the two local repos to each other, never to what's actually being served live.

## Immediate fix
Ran `vercel --prod --yes` from a confirmed clean, up-to-date `staff-req-sync3` worktree (verified `git status` clean and HEAD matching the pushed commit first). Confirmed via curl against `dm-dashboard.vintageinterior.co.uk` that the live site now contains all 4 commits' content (EOD Admin, Performance Analysis grouping, Blog Tool, muguntha.html's `mg-embed` embed fix).

## Permanent fix — scripts/check-live-deploy.js
Added a script that fetches known "canary" strings from the live `pages/*.html` files at `dm-dashboard.vintageinterior.co.uk` and diffs them against the local Staff-requirements worktree. Run after every push touching `api/`/`pages/` files (and again ~30s later once a deploy would have landed). Reports MISMATCH with a clear fix instruction if live content is stale. Verified working: correctly reported OK against all 4 canaries after the manual redeploy.

Saved as a standing memory (`feedback_verify_live_deploy_not_just_repo_sync`) — explicitly states that "repo-sync clean" and "live site correct" are two separate claims that both need checking, and links to the existing `feedback_repo_sync_check_before_ending` memory as the layer below it.

## Open question (not resolved this session)
Could not determine from the Vercel CLI alone *who or what* is running the stray manual `vercel --prod` deploys that raced ahead of the git-triggered ones (no git/commit metadata surfaced in `vercel inspect` output for any deployment, CLI or git-triggered). Worth asking Piranav directly whether he or any automation runs `vercel --prod` outside of git pushes.

## Files touched
- `reports/digital-marketing-member-pages/scripts/check-live-deploy.js` (new, both repos)

## Deployment
Deployed to production manually (`vercel --prod --yes`), confirmed live via `check-live-deploy.js` and direct curl.

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** Run `check-live-deploy.js` after every future push touching api/ or pages/ files. If it ever fails again, redeploy from a known-good checkout immediately, and separately investigate who/what is issuing stray manual deploys.
