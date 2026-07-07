# Vercel Deploy Prompt — for Piranav's usage

**Date:** 2026-07-06
**Owner:** Kuberan (for coworker Piranav)

## Objective
Ready-to-paste prompt Piranav can give his Claude to deploy a report/site folder to Vercel, following the same method used for `reports/digital-marketing-member-pages`.

## Prerequisites (one-time, per project folder)
- Folder must already be linked to a Vercel project (`.vercel/project.json` exists). If not, run `vercel link` inside that folder first.
- `vercel` CLI must be installed (`npm i -g vercel`).

## Prompt to paste

```
Deploy the [FOLDER NAME] folder to Vercel.

Steps:
1. Check git status for that folder — if there are uncommitted changes, commit them first (ask me before committing if unsure what to include).
2. Confirm the folder has .vercel/project.json (already linked). If missing, tell me instead of running `vercel link` without asking.
3. Ask me whether this should be a preview deploy or a production deploy (--prod). Do not deploy to production without my explicit "yes".
4. Run the deploy from inside that folder:
   - Preview: vercel
   - Production: vercel --prod --yes
5. Report back: deployment URL, status (READY/ERROR), and commit SHA deployed.
```

## Notes
- Swap `[FOLDER NAME]` for the actual path, e.g. `reports/digital-marketing-member-pages`.
- Production deploys always need explicit user confirmation — never auto-confirm.
- If build errors occur, fetch logs with `vercel logs <deployment-url>` before troubleshooting.

## Outcome
Piranav can reuse this prompt for any Vercel-linked report folder without re-deriving the deploy steps each time.
