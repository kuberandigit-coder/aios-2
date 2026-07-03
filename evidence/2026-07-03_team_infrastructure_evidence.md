# Evidence — Team infrastructure: shared repo, Piranav onboarding, Vercel git root cause (2026-07-03)

**Title:** Team infra evidence · **Owner:** Kuberan · **Reviewer:** Kuberan · **Status:** DONE
**Purpose:** Record the account-switch/team-scaling infrastructure work of 2026-07-03.

## 1. Account switch continuation
New Claude account picked up from `handover/2026-07-03_dilaksi_req3_CONTINUATION_PROMPT.md`. Bonus: new account has the **Semrush MCP connector** (previously missing) — unblocked Req 3 backlinks.

## 2. Shared team repo
- Created private repo **digitalmarketing69140951-sys/Staff-requirements** (fresh, after deleting old `Staff-requirements-`).
- Collaborator invite to kuberandigit-coder was stuck pending → **accepted via GitHub API** using the PC's stored credential.
- Initially pushed the full AIOS system by mistake; Kuberan corrected: **dashboard only** → `git subtree split` of `reports/digital-marketing-member-pages` force-pushed (69 commits of folder history kept). Repo contents verified: index.html, pages/, assets/ only.
- **Two-writer flow proven:** Piranav pushed hetheesha req1; merged into private repo (byte parity verified) without losing work. His clone note: after history rewrites he must `git fetch && git reset --hard origin/main`.

## 3. Piranav onboarding
- `handover/2026-07-03_piranav_onboarding_prompt.md` — full Claude Code first-message prompt (clone, key file location `C:\Users\<user>\.keys\ga4-service-account.json`, connectors, working rules, style reference, verification standard).
- To send him: that file + the GA4/GSC service-account JSON (privately). Verified the single key serves BOTH GA4 (property 408110563) and GSC (sc-domain:ledsone.co.uk, Restricted) via live API calls.

## 4. Vercel ↔ GitHub deploy root cause (the day's big debugging)
- Symptom: git-triggered deployments hung "Building/UNKNOWN" 10-25+ min; CLI deploys queued behind them (1 build slot).
- Dead ends eliminated: build settings were already correct (framework None, no build command — checked via API).
- **Root cause (via API):** `readyState: BLOCKED` — Vercel deployment protection blocks deployments whose **git author isn't an authorized team member**. kuberandigit-coder commits = blocked.
- **Proof:** identical push authored as `digitalmarketing69140951@gmail.com` deployed and went live in **10 seconds**. This is now the standard deploy path (authorized-author push) until Kuberan approves the other git authors in the Vercel dashboard (one-time).
- Cleanup: removed stuck deployments; `vercel git disconnect` was used mid-diagnosis and Kuberan later reconnected the integration; stray `staffreq-test` clone found in the dashboard folder and deleted (never committed/deployed).

**Files Created:** onboarding prompt, this evidence; daily log sections. **External Sources:** GitHub API, Vercel API/CLI (all with stored logins).
**Known Limitations:** kuberandigit-coder + Piranav's git authors still unapproved in Vercel (their pushes get BLOCKED until Kuberan approves once in the dashboard).
**Next Steps:** Kuberan approves both git authors; add Piranav as Staff-requirements collaborator if not yet done.
**PASS/FAIL:** PASS
