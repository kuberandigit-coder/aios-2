# Capabilities — 2026-09-03

## Capability — Git Branching Workflow + "Dev Tools" Merge UI (origin)

**Date:** 2026-09-03
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Live, the standing workflow for this project since — this is the origin of the "Dev
Tools" merge mechanism referenced throughout this project's entire later history (including today's
own 2026-10-08 catch-up work, "merged via Dev Tools" appears on dozens of later commits).

### Capability

A two-branch workflow (`dev-work` for Kuberan's own work, `piranv-work` for Piranav's), with `main`
as the production-safe base, surfaced through a dedicated **Dev → Branches** admin page: shows both
branches' diffs against `main` in detail (what changed, by whom), with a merge button.

### Technical implementation

- A fine-grained GitHub PAT (`DM_DASHBOARD_GITHUB_TOKEN`, Contents + Pull Requests read/write,
  scoped to just this one repo) — generated and added directly to both local and server `.env`
  files, never pasted into chat.
- A standing automated instruction for Piranav's own Claude Code sessions: every task he completes
  gets pushed to `piranv-work` only, permanently, without him needing to remember the command each
  time.

### Originating task

`closure/dm-dashboard/2026-09-03_git-branching-workflow-setup.md`

### Reuse — confirmed the standing mechanism for this entire project since

Every later dm-dashboard feature closure found in this AIOS history references being "merged to
main via the usual Dev Tools process" or similar — this page and workflow is that mechanism's
origin, not a one-off.

### Limitations

Written up from a closure doc noting its source is "a Claude session record (not git log)" — the
exact Branches page component/route was not independently located as part of this
capability-ization.
