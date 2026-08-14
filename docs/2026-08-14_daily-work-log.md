# Daily Work Log — 2026-08-14

## Summary
Added Blog Tool, Performance, 2026 New Listings, EOD Tool, and EOD Admin (kuberan-only) to kuberan/piranav's sidebar and grouped it into sections, fixed two follow-on bugs those additions exposed (muguntha.html's page-level auth guard, then its duplicate embedded sidebar), and then found and permanently addressed a much bigger bug: the live production site was silently out of sync with fully-pushed, repo-synced code.

## Tasks Completed

1. **Sidebar additions for kuberan/piranav** — added Blog Tool, Performance, and 2026 New Listings links (deep-linking into muguntha.html via `?embed=1#performance` / `?embed=1#listing`), then EOD Tool (`eod/index.html`), then EOD Admin (`eod/admin.html`, kuberan-only), and finally split the whole sidebar into grouped sections (Overview / Performance Analysis / Tools / Team Tools) matching muguntha.html's existing pattern.

2. **muguntha.html auth guard bug** — the Performance/2026 New Listings links bounced to login because muguntha.html's own page-level guard only allowed `staff_key === 'muguntha'`. Fixed by allowing `kuberan`/`piranav` through too.

3. **Duplicate sidebar bug** — once the guard let kuberan/piranav in, muguntha.html's own full sidebar rendered nested inside kuberan/piranav's sidebar+iframe. Fixed by adding `?embed=1` param support to muguntha.html, eod/index.html, and eod/admin.html — each now hides its own sidebar/collapse button when loaded embedded, and the outer sidebar links pass `?embed=1`.

4. **Live deploy vs. repo sync bug (major) — root cause + permanent fix.** User reported the sidebar was still missing everything on the live site, despite 4 commits being pushed and `check-repo-sync.js` reporting FULLY IN SYNC every time. Root cause: the Vercel project IS connected to Staff-requirements for auto-deploy, but any manual `vercel --prod` run from a stale local checkout instantly re-aliases production over a correct git-triggered deployment, with no error and no git trace — a bug class `check-repo-sync.js` can never catch since it only compares two local repos to each other. Fixed immediately by running `vercel --prod` from a verified clean, up-to-date worktree. Built `scripts/check-live-deploy.js` as a permanent detection tool (curls known canary strings from the live site, diffs against local code) and saved a standing memory. Confirmed working same session. Who/what triggers the stray manual deploys is still unidentified — flagged as an open question for Kuberan/Piranav.

## Files Touched
- `reports/digital-marketing-member-pages/pages/kuberan.html`, `pages/piranav.html` (both repos)
- `reports/digital-marketing-member-pages/pages/muguntha.html` (both repos)
- `reports/digital-marketing-member-pages/pages/eod/index.html`, `pages/eod/admin.html` (both repos)
- `reports/digital-marketing-member-pages/scripts/check-live-deploy.js` (new, both repos)

## Status
All deployed to production and confirmed live via direct curl and `check-live-deploy.js`.

## Outstanding
- Identify what is issuing stray manual `vercel --prod` deploys that raced ahead of git-triggered ones (couldn't be determined from Vercel CLI metadata alone).
- Carried over from 2026-08-11/12/13 (not touched today): jeffri-meta July backfill not run, large page-file sizes (kamsi/mahima/dilaksi), login page logo still hotlinked.
