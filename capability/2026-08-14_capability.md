# Capabilities — 2026-08-14

## Capability — Live-Deploy-vs-Repo Mismatch Detector (permanent, bidirectional)

**Date:** 2026-08-14
**Owner:** Kuberan
**Project:** digital-marketing-member-pages
**Status:** Built, tested, extended, proven working

### Capability

A permanent detection tool (`scripts/check-live-deploy.js`) that catches **both directions** of a
live-site-vs-git mismatch: the live site being stale (git has changes production doesn't), and the
live site being *ahead* of git (someone deployed manually via `vercel --prod` without committing,
so production has content git doesn't know about).

### What problem it solves

This is the 4th documented instance of dual-repo/deploy-drift issues in this project's history
(after the 2026-07-29 dual-repo deploy hazard, the 2026-08-13 sync-drift script, and the 2026-07-28
Thasitha deploy gap) — but this is the first fix that explicitly handles the **reverse** direction:
a redeploy of "known-good" code can itself cause a regression by silently overwriting
uncommitted-but-live work. That exact failure happened this same day: the first manual redeploy
fixed one issue but reverted Piranav's uncommitted Staff ID Performance tabs; the second redeploy
corrected that regression.

### Originating task

`closure/digital-marketing-member-pages/2026-08-14_live-deploy-vs-repo-sync-bug-and-permanent-fix.md`

### Related

`2026-07-29_capability.md` (the original dual-repo deploy hazard), `2026-08-13_capability.md` (the
earlier sync-drift detector — that one diffs two *repos* against each other; this one diffs the
*live site* against git, catching the case where production itself has drifted from both repos).

### Reuse

**Before redeploying "known-good" code over a live mismatch, check whether production currently
has content git doesn't** — this is now a standing step, not just a one-time fix. The task's own
next step: ask any contributor who deploys manually via `vercel --prod` to also commit+push, so
uncommitted live features stop existing as a category at all.

### Limitations

This fix makes the mismatch detectable and recoverable; it does not prevent a contributor from
deploying manually without committing in the first place — that remains a process/discipline gap,
not a code-level guarantee.
