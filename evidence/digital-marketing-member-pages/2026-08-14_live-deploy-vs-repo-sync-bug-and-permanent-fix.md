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

## Open question (partially answered — see correction below)
Could not determine from the Vercel CLI alone *who or what* is running the stray manual `vercel --prod` deploys that raced ahead of the git-triggered ones (no git/commit metadata surfaced in `vercel inspect` output for any deployment, CLI or git-triggered).

## Files touched
- `reports/digital-marketing-member-pages/scripts/check-live-deploy.js` (new, both repos)

## Deployment
Deployed to production manually (`vercel --prod --yes`), confirmed live via `check-live-deploy.js` and direct curl.

**Status:** PASS (superseded by correction below — the fix itself caused a regression)
**Reviewer:** Kuberan (pending review)

---

## CORRECTION — 2026-08-14, same day, later in session

The "Immediate fix" above (redeploying from a clean git-tracked worktree) **caused a regression**: user reported the Staff ID Performance page had lost content that was live moments earlier ("you just missed the piranav deploy from this page"). Investigation via `vercel ls` + curling several historical deployment URLs directly (bypassing the aliased domain) showed the live site had been *alternating* between two different versions of `pages/staff-id-performance.html`:
- A 2-tab version (Kamsi, Dilaksi only) — this is what git HEAD contained, i.e. what my "known-good" redeploy pushed.
- A 5-tab version (+ Jackson, Sajeepan, Sonya) with matching backend support in `api/staff-id-performance.js` — **never committed to git on either repo**, only ever deployed live by Piranav via manual `vercel --prod` from his own local files.

So the answer to "who's running stray manual deploys" is: **Piranav, deploying features directly to production without always committing them to GitHub** — the same failure mode as the original bug, but in reverse (git missing what's live, not live missing what's in git). My redeploy silently reverted his uncommitted feature.

**Recovery:** Used `vercel api /v6/deployments/<id>/files` to get the file tree + content uid for the fuller deployment (`dpl_BTZ3Zbrn7FC4ZBGqyy683aM6S55t`), then `vercel api /v7/deployments/<id>/files/<uid>` to fetch each file (base64-encoded in the `data` field), decoded, validated (`node --check` on the JS), and committed both files to git on both repos — so this specific feature can no longer be silently reverted. Redeployed to production; confirmed all 5 tabs live via curl.

Added 3 more canaries to `check-live-deploy.js` for this feature, and rewrote its header comment plus the standing memory to explicitly warn: a live/git mismatch can mean **production has something newer that git is missing**, not just something stale — check both directions before redeploying "the correct code" over a live site.

**Status:** PASS
**Reviewer:** Kuberan (pending review)
**Next step:** Ask Piranav to always commit+push features to Staff-requirements before or immediately after any manual `vercel --prod` deploy — the technical safety net (`check-live-deploy.js`) now covers this specific feature, but not any future one he deploys without committing.
