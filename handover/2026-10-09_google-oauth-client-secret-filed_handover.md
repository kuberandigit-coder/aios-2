# Handover — Google OAuth Client Secret Filed

**Date:** 2026-10-09 · **Owner:** Kuberan

## What's done

A Google OAuth "installed app" client secret JSON (`client_id` ending `...googleusercontent.com`,
project `erudite-justice-506911-r7`) was moved from Downloads into `api-keys/` (git-ignored local
vault) and indexed at `api-keys/14_google_oauth_client.md`. `.gitignore` hardened with an explicit
`client_secret*.json` rule. Verified ignored/untracked/unstaged via `git check-ignore`/`git ls-files`/
`git status`.

**Same-day follow-up:** the file was moved again, this time into the **dm-dashboard** repo at
`backend/api-keys/` (it no longer lives in this repo's vault). dm-dashboard's own `.gitignore` was
updated with the same `backend/api-keys/` + `client_secret*.json` rules, verified ignored/untracked/
unstaged there too — no commit/push made in dm-dashboard. This repo's `api-keys/14_google_oauth_client.md`
and `api-keys/00_README.md` updated to point to the new location.

## Open item

**Purpose of this credential is not yet known** — no task/project context was given with it. If a
future session needs to use it, check `backend/api-keys/` in the **dm-dashboard** repo (not this
one anymore) and confirm with Kuberan what it's for before wiring it into any code.

## Evidence

`evidence/2026-10-09_google-oauth-client-secret-filed_evidence.md`
