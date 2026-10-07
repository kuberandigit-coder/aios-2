# Handover — CI/CD: GitHub Actions auto-deploy to Contabo VPS

Date: 2026-10-07
Status: **Live and verified. See closure.**

## What changed for day-to-day work

Merging `dev-work` into `main` (via the dashboard's own "Branches" dev tool, or any other
route) now triggers an automatic deploy to production within ~30 seconds — no one needs to SSH
in and run `deploy.sh` by hand anymore. The manual route still works as a fallback.

## Where everything lives

- `.github/workflows/deploy.yml` (dm-dashboard repo, on `main`) — the workflow itself.
- `docs/CI-CD-SETUP.md` (dm-dashboard repo) — the live reference doc, written for a new
  developer or their LLM to read first.
- `ci-cd-setup/` (this AIOS repo) — the setup record: a Word doc + screenshots, kept as
  evidence of how it was set up, not meant to be kept updated going forward.
- 4 secrets in GitHub (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT`) — never in any
  repo.

## Known/accepted limitations (unchanged by this work, documented for awareness)

- Deploys always run the FULL pipeline (`git pull` + `pip install` + `npm run build` +
  `systemctl restart`) regardless of how small the actual change is — `npm run build` rebuilds
  the entire frontend bundle every time, not incrementally. This is `deploy.sh`'s own existing
  design, not something CI/CD changed; a manual deploy takes the same time.
- Still single-worker (`DEPLOYMENT.md`'s existing warning) — unrelated to this change, not
  solved by it.
- No safety-gate test job was added (the optional `py_compile`/`vite build` pre-check documented
  in the original `CI-CD-SETUP.md` draft) — the live workflow deploys directly without a build
  check first. Flagged as a possible future improvement, not implemented, per the user's explicit
  instruction to keep the initial setup minimal.

## Next step

None blocking. Optional future improvement: add the safety-gate test job (documented in
`docs/CI-CD-SETUP.md`'s "Optional — add a safety gate" section) if a broken merge auto-deploying
becomes a real concern.
