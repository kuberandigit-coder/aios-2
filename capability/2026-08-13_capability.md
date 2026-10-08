# Capabilities — 2026-08-13

## Capability — Dual-Repo Sync-Drift Detector Script

**Date:** 2026-08-13
**Owner:** Kuberan (Jefri Req5 follow-up)
**Project:** digital-marketing-member-pages
**Status:** Live, proven on its first real use the same day it was added

### Capability

A Node script that byte-for-byte diffs every `api/*.js` and `pages/*.html` file (ignoring
line-ending differences) between the `aios-2` repo and the `Staff-requirements` worktree, exiting
non-zero with a clear file list if anything is missing or mismatched in either direction.

### What problem it solves

This project is deployed from two separate repos/worktrees (confirmed elsewhere in AIOS as a known
hazard — see the 2026-07-29 dual-repo deploy capability), and a push from one contributor (e.g.
Piranav) to one repo can silently drift the other out of sync with no automatic warning.

### Technical implementation

`reports/digital-marketing-member-pages/scripts/check-repo-sync.js` — run via
`node scripts/check-repo-sync.js` from the `digital-marketing-member-pages` folder.

### Validation (unusually strong — caught a real drift on first use)

Immediately after adding and pushing the script, running it again caught a brand-new drift
(Piranav's `members-api.js` push that landed mid-session) within seconds — exactly the failure
mode it was built to catch, demonstrated in practice on its very first real run, not just a
synthetic test.

### Originating task

`evidence/jefri/2026-08-13_requirement-5-cross-repo-sync-bug-and-permanent-fix.md`

### Related

`2026-07-29_capability.md` — the dual-repo deploy hazard this script directly addresses.

### Reuse

Intended to be run any time there's a risk of drift between the two repos (e.g. after any external
contributor's push), not a one-time check.
