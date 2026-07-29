# Vercel Notes — Thasitha Requirement 2: Live Refresh

**Title:** Req2 live refresh — deployment
**Purpose:** Record the deploy path and the mid-deploy fixes that were needed.

## Deploy path
1. Built and syntax-checked in `kuberan web/reports/digital-marketing-member-pages`.
2. Synced to `staff-sync28` worktree, committed, rebased onto `staff/main`, pushed — auto-deployed via Vercel's git integration.
3. Live-tested the endpoint immediately (`curl .../api/requirement?fn=thasitha-req2&refresh=1`) — found 2 real bugs (stock fetch silently failing, `first_date` mis-formatted). Fixed both, re-synced, re-pushed, re-verified live before touching the frontend.
4. Wired the frontend (`thasitha.html`), synced, committed, pushed — verified live via curl that `t2RefreshBtn`/`t2LiveChip` render.
5. Committed both files to the primary `aios-2` repo for source-of-truth parity.

## Status
Live in production. No manual `vercel --prod` needed — git-linked auto-deploy handled it both times.
