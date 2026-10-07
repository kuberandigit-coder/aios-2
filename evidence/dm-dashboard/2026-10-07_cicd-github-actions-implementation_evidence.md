# Evidence — CI/CD: GitHub Actions auto-deploy to Contabo VPS

Date: 2026-10-07
Repo: dm-dashboard. `.github/workflows/deploy.yml` committed directly to `main` (via GitHub's
web editor, following the documentation-only guide already prepared in
`docs/CI-CD-SETUP.md`). Branches page UI warning + test marker on `dev-work`.

## What was built

- A dedicated SSH keypair, generated only for GitHub Actions (not reusing any personal key).
- The public key added to the Contabo VPS's `~/.ssh/authorized_keys`.
- 4 encrypted GitHub repository secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT`)
  — never committed to the repo.
- `.github/workflows/deploy.yml` — triggers on every push to `main`, SSHes in via
  `appleboy/ssh-action`, runs the existing `/var/www/dashboard-dm/deploy.sh` unchanged.
- A visible warning on the dashboard's own "Branches" dev tool page (`DevBranches.jsx`), both as
  a persistent banner and inside the merge-confirmation dialog, so clicking "Merge into main"
  there now makes clear it triggers a real production deploy.

## Live verification (not just "it should work")

1. The commit that added `deploy.yml` was itself a push to `main` — it immediately triggered the
   very first automated run. Confirmed in GitHub's Actions tab: green check, completed in 19
   seconds.
2. Confirmed independently on the VPS itself via `journalctl -u dm-dashboard -n 20 --no-pager`:
   a real `Stopped`/`Started` service pair with a timestamp matching the Actions run — proving
   the backend genuinely restarted with new code, not just that GitHub showed a green check.
3. A second real test: a small visible-text change (the deploy-warning UI) was merged, and a
   follow-up temporary marker (`"Branches 🟢 CI/CD test marker..."`) was pushed specifically to
   let the user visually confirm a deploy by refreshing the live page after merging.

## Full screenshot record

11 screenshots (trimmed to the 8 that show a clean success path, per explicit request — error/
detour screenshots removed) plus a Word write-up are kept in the AIOS repo:
`ci-cd-setup/CI-CD-Setup-dm-dashboard.docx` and `ci-cd-setup/screenshots/`.

## Documentation

`docs/CI-CD-SETUP.md` in the dm-dashboard repo is the live, always-current reference — written
to lead with current status and a "new developer start here" section (what runs the deploy,
where to watch it, which secrets it depends on, a troubleshooting table, key-rotation steps),
with the original step-by-step setup walkthrough kept below as reference. Linked from
`docs/README.md` and `docs/DEPLOYMENT.md`.
