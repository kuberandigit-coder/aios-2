# Capability — Priority-Ordered Group Matching + Dual-Repo Deploy Hazard

**Date:** 2026-07-29
**Owner:** Kuberan
**Staff/Requirement:** salesuk.html (all groups)
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed and live

## Capability
Two reusable pieces of technical knowledge from growing salesuk.html to 11 groups across 7 months:
1. How to build an attribution system where "no double-counting" is a property of the code, not a rule someone has to remember.
2. How to detect and defend against a second, independently-cron-deploying Git remote silently overwriting production.

## What Was Implemented
`GROUPS` array checked in a fixed priority order; `assignGroup()` returns the first match. Extended with **second-session** and **last-session lookthrough** (check later customer-journey sessions for a campaign when the first session has none) and both **permanent** and **month-scoped** matching rules living side-by-side in the same match function. A virtual "Not Assigned" group (not in `GROUPS`, computed as the logical complement) guarantees every order lands somewhere, visibly.

## Technical Knowledge
- **Mutual exclusivity by construction**: model competing ownership rules as an ordered list, first-match-wins, not N independent checks each evaluated in isolation — this is what actually prevented the double-counting bug that motivated the whole page.
- **Untraceable ≠ unassignable without checking**: before leaving an order in an unassigned pool, check every session in its journey (not just first) for a campaign — this recovered dozens of orders per month across Sonya/Sajeepan/DM-Ad that looked untraceable from the first session alone.
- **A live-looking data field can still be wrong**: `matchValue()` needing the same `journey` argument as `match()` is easy to miss when adding a new parameter to one but not the other — caused a silent mislabeling bug across every group simultaneously. Test by fetching real output, not just checking the match count.
- **Dual-deploy hazard**: if a Vercel project is git-linked to a repo with its own cron-triggered auto-deploy (here: `Staff-requirements`, hourly), any change made only to a *different* repo (here: `aios-2`) that also has push/CLI-deploy access to the same Vercel project will be silently reverted the next time the cron fires. Detection: a previously-working endpoint suddenly 404s with no code change of your own; check `vercel inspect <deployment> --logs` for `Cloning github.com/<other-repo>`. Fix: keep both repos synced after every change (a `git worktree` against the second remote works well for this).

## Files / Components
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `Staff-requirements` repo (second remote, `.github/workflows/hourly-july-snapshot-refresh.yml`)

## Data Sources / Tools
Shopify Admin GraphQL API (`ledsone.co.uk`), `git worktree` for dual-repo sync, `vercel inspect --logs` for deploy-source diagnosis.

## Validation
Live-verified across all 11 groups, 7 months; dual-deploy hazard reproduced once (salesuk.js vanished from production), root-caused via deployment logs, and fixed by sync — confirmed stable across many subsequent deploys afterward.

## Reuse
Apply the same priority-ordered-array + Not-Assigned-complement pattern to any future multi-owner attribution problem on this dashboard. Always check `Staff-requirements` sync status before assuming a deploy "didn't work" on this specific Vercel project.

## Evidence
`evidence/salesuk/2026-07-27_to-29_full-buildout-and-cleanup.md`

## Limitations
Not-Assigned tab is read-only — no in-browser "assign this order" persistence yet (needs a GitHub token or an equivalent write path, deferred pending user decision).
