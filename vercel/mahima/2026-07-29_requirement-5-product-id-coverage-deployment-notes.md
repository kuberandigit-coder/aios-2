# Vercel Notes — Mahima Requirement 5: Product ID Coverage

**Title:** Product ID Coverage Tab — deployment
**Purpose:** Record how this change was deployed given the known dual-repo (aios-2 / Staff-requirements) hazard.

## Deploy path taken
1. Built and tested in `kuberan web/reports/digital-marketing-member-pages` (primary working copy).
2. Copied both changed files into the `staff-sync28` worktree, committed, rebased onto `staff/main` (which had moved ahead via an unrelated hourly-cron snapshot commit), pushed to `staff/main` — commit `6b03976`.
3. Vercel's git-linked auto-deploy (project `digital-marketing-member-pages`, linked to `Staff-requirements`) picked up the push automatically — no manual `vercel --prod` needed.
4. Verified live within ~1 minute via `curl https://digital-marketing-member-pages.vercel.app/pages/mahima.html` (found "Requirement 5 — Product ID Coverage") and `curl .../api/requirement?fn=mahima-req5` (returned valid JSON, `success:true`).
5. Fast-forwarded the third local checkout at `C:\Users\PC\Documents\piranav_aios\Staff-requirements` (same GitHub remote as `staff`, was stale at commit `81f920b` from 2026-07-21) up to the new HEAD — no separate push needed since it's the same remote.
6. Committed the same two files to the primary `aios-2` repo (`kuberan web`) for source-of-truth parity.

## Status
Live in production. No separate manual deploy step was required this time — the auto-deploy fired correctly.
