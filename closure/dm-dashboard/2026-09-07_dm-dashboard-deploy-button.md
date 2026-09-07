# Closure — Deploy button: built, tested, then removed by decision (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard
**Status:** Closed — reverted, no net change to production behavior

## Request
"my work flow is changes made and push to branch and merger by frontend
and then deploy also" — wanted a Deploy option in the frontend.

## What happened
Discussed a fully-automated one-click deploy (needs server-side setup:
secret token, narrow sudoers rule — declined, no SSH access available)
vs. a semi-automated version (merge + log the request + hand back the
exact SSH command, no server access needed).

Built and live-tested the semi-automated version: Dev → Branches got a
Deploy button next to Merge, disabled until merged, logging requests to
a new `dev_deploy_requests` table and returning a copy-paste deploy
command. Verified end-to-end with a visible sidebar-text test change.

**Final decision:** user decided manual deploy is safer — fully
reverted (Deploy button, backend endpoints, test marker all removed).
Merge into main is unchanged from before this task.

## Files (net effect: reverted)
- `backend/app/dev_branches.py`
- `frontend/src/admin/pages/DevBranches.jsx`
- `frontend/src/dev/DevLayout.jsx`
