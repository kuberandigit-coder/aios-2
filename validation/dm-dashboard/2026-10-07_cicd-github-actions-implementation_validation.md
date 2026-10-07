# Validation — CI/CD: GitHub Actions auto-deploy

Date: 2026-10-07

| Check | Result | PASS/FAIL |
|---|---|---|
| Dedicated deploy key, not a personal key | Confirmed — generated specifically for this, comment `github-actions-deploy` | PASS |
| Private key never committed | Confirmed — only the `.pub` key exists in any git-tracked location (AIOS `ci-cd-setup/`); a `.gitignore` there additionally blocks the private key pattern | PASS |
| Secrets stored only in GitHub's encrypted store | Confirmed via screenshot — 4 secrets listed under Settings > Secrets and variables > Actions | PASS |
| Workflow triggers on push to `main` only | `on: push: branches: [main]` in `deploy.yml`, confirmed by reading the committed file | PASS |
| Workflow runs the EXISTING `deploy.sh`, doesn't reimplement deploy logic | `script: /var/www/dashboard-dm/deploy.sh` — single line, no duplicated pull/build/restart logic | PASS |
| First real run succeeded | GitHub Actions tab, green check, 19s, screenshot captured | PASS |
| Backend genuinely restarted (not just a green UI checkmark) | `journalctl` on the VPS itself shows a real `Stopped`/`Started` pair matching the run time | PASS |
| User-visible UI warning added before the risk became real | `DevBranches.jsx` banner + confirm-dialog warning, pushed and build-verified before the first live merge-triggered deploy happened | PASS |
| Second live test (post-warning) | Temporary visible marker pushed specifically to let the user confirm a second real deploy by eye | PASS (pending user's own visual confirmation after their next merge) |
| Dev-facing documentation exists and is discoverable | `docs/CI-CD-SETUP.md`, linked from `docs/README.md` and `docs/DEPLOYMENT.md` | PASS |

## Overall

**PASS.** CI/CD is live, verified by two independent methods (GitHub's own UI and direct VPS
log inspection), documented for future developers, and the one in-dashboard risk (merging now
deploys) is now surfaced to the user before they click, not after.
