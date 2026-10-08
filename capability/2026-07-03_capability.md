# Capabilities — 2026-07-03

## Capability — Vercel/GitHub Deploy Authorization Root Cause + Standard Deploy Path

**Date:** 2026-07-03
**Owner:** Kuberan
**Project:** `digital-marketing-member-pages` (Staff-requirements repo, Vercel)
**Status:** Root cause confirmed, standard deploy path established, still in active use (referenced
in project memory as the standing rule for this repo as of 2026-10-08)

### Capability

Diagnosed and permanently solved why git-triggered Vercel deployments hung "Building/UNKNOWN" for
10-25+ minutes while CLI deploys queued behind them (one build slot) — and established the
standing deploy convention this project still follows.

### Root cause (found via direct API inspection, not guessed)

`readyState: BLOCKED` — **Vercel's deployment protection silently blocks any deployment whose git
author isn't an authorized team member.** The `kuberandigit-coder` git author was blocked; an
identical push authored as the authorized `digitalmarketing69140951@gmail.com` account deployed
and went live in **10 seconds**.

### Standard deploy path established (still the rule)

Push as the authorized git author (`digitalmarketing69140951@gmail.com`), not `kuberandigit-coder`
or any other unapproved author, until each new author is explicitly approved once in the Vercel
dashboard. This is the exact rule still referenced in this project's standing memory as of
2026-10-08 ("Vercel blocks unauthorized git authors (deploy as digitalmarketing author)").

### Other reusable techniques from the same day

- **Safe dashboard-only subtree push**: when a full-AIOS push happened by mistake into the shared
  team repo, corrected via `git subtree split` of just `reports/digital-marketing-member-pages`,
  force-pushed with its 69 commits of folder history intact — a reusable technique for extracting
  one subfolder's full history into its own repo without losing history.
- **Two-writer post-rewrite recovery**: after a history rewrite, the other writer (Piranav) must
  run `git fetch && git reset --hard origin/main` — documented as the standard recovery step for
  any future history rewrite on a repo with more than one active pusher.
- **Single service-account key covering two Google APIs**: confirmed one JSON key serves both GA4
  (by property ID) and GSC (by `sc-domain:` property) via live API calls — worth checking before
  assuming two separate credentials are needed for a new team member's onboarding.

### Originating task

`evidence/2026-07-03_team_infrastructure_evidence.md`

### Limitations

The git-author approval was still pending for `kuberandigit-coder` and Piranav at the time this was
written ("Next Steps: Kuberan approves both git authors") — whether that follow-up step was ever
completed was not traced forward as part of this capability-ization.
