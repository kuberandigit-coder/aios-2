# Evidence — Google OAuth Client Secret Filed, .gitignore Hardened

**Date:** 2026-10-09
**Requested by:** Kuberan

## What was done

1. Confirmed existing AIOS records first (`evidence/`, `handover/`, `api-keys/`) for any prior
   mention of this credential (client ID `997811445503-s29lrj2c0ddp4tckr2hb6ut9r0gqu7u6`) — none
   found, not a duplicate of any existing record.
2. Moved `client_secret_997811445503-s29lrj2c0ddp4tckr2hb6ut9r0gqu7u6.apps.googleusercontent.com.json`
   from `Downloads` into `api-keys/` (the project's existing, git-ignored local credential vault —
   `api-keys/00_README.md`).
3. Added `api-keys/14_google_oauth_client.md` — a reference entry (project ID, client type,
   status) per the vault's existing one-file-per-credential convention, without duplicating the
   secret value into a second place.
4. Hardened `.gitignore`: `api-keys/` and the global `*.json` rule already covered this file;
   added an explicit `client_secret*.json` rule plus a comment, so the exclusion is clear at a
   glance rather than relying on the broad catch-all alone.
5. Verified, not assumed:
   - `git check-ignore -v` confirms the file matches the `api-keys/` rule.
   - `git ls-files --error-unmatch` confirms it is not tracked.
   - `git status --short api-keys/` shows nothing — not staged, not appearing as untracked.

## Update — 2026-10-09 (same day, follow-up)

The file was relocated again, this time into the **dm-dashboard** repository at
`backend/api-keys/` (its own separate git repo, not this one). In that repo:
- Created `backend/api-keys/`, moved the JSON there from this vault.
- Added `backend/api-keys/` and `client_secret*.json` rules to dm-dashboard's own `.gitignore`
  (separate file from this repo's `.gitignore`), with an explanatory comment.
- Verified the same way: `git check-ignore -v` matched the new `backend/api-keys/` rule,
  `git ls-files --error-unmatch` confirmed untracked, `git status --short backend/api-keys/`
  showed nothing.
- No commit or push made in dm-dashboard, per explicit instruction for this follow-up task.
- The file no longer exists in this repo's `api-keys/` folder — `api-keys/14_google_oauth_client.md`
  and `api-keys/00_README.md` here updated to point to the new location instead of duplicating
  this record.

## Known gap

The credential's intended use (which task/project it's for) was not specified alongside it —
flagged in `api-keys/14_google_oauth_client.md` as unconfirmed, not guessed at. Do not wire it
into any code until that's clarified.

## Files changed

This repo: `.gitignore` (committed, no secret content). `api-keys/00_README.md`,
`api-keys/14_google_oauth_client.md` updated in place — git-ignored, not committed, consistent
with every other file in this vault. dm-dashboard repo: `.gitignore` updated (not committed, per
instruction); the JSON itself lives there now, git-ignored, untracked.

## Status

**Done.** File filed in its final location (dm-dashboard `backend/api-keys/`), ignore rules
verified in both repos, no secret exposed in git or in any AIOS document.
