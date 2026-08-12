# Evidence — Google Safe Browsing "Dangerous Site" Flag: Custom Domain Migration (2026-08-12)

**Purpose:** Record of an infrastructure-level incident and its resolution. **This work involved no git commits** — it was Vercel dashboard/CLI, DNS, and Google Search Console actions, not code changes. Documented here from direct session actions and verified outcomes.

## Problem
The primary production URL, `digital-marketing-member-pages.vercel.app`, was flagged by Google Safe Browsing under "Deceptive pages." Confirmed via:
- Google Transparency Report API (`transparencyreport.google.com/transparencyreport/api/v3/safebrowsing/status?site=...`).
- Google Search Console → Security Issues, showing sample flagged URLs `/` and `/login.html`.

Root cause is a well-known false-positive pattern: a login-form page on a shared/free platform subdomain (`*.vercel.app`) matches Google's automated "deceptive login page" heuristics. This is unrelated to SSL — the site was already fully HTTPS/SSL-secured automatically via Vercel, and purchasing an SSL certificate (considered by the user) would have had zero effect on the flag.

## Actions taken
1. **Search Console site verification** — added `googlebb3d8c1bfef3e723.html` at the project root (git-tracked, `43eb08e`), submitted a review request via Search Console. Status: submitted successfully, response still pending as of 2026-08-12 — now low priority.
2. **Temporary no-login EOD-only project** — deployed a standalone Vercel project (`eod-public`, live at `https://eod-public.vercel.app/eod.html`) containing only `eod.html`/`eod-ads.html`/`eod-seo.html`/`eod-tec.html` with the auth guard stripped, giving the team uninterrupted EOD Reports access during the outage. **Not tracked in either `aios-2` or `Staff-requirements`** — lives at `C:\Users\PC\OneDrive\Desktop\eod-public\`, deployed directly via Vercel CLI as its own project. Original filenames were explicitly kept (not renamed to `index.html`) per direct instruction, after an initial rename attempt broke 3 internal back-links and was reverted same session.
3. **Permanent fix — real custom domain** — connected `dm-dashboard.vintageinterior.co.uk` (a subdomain the user owns via their existing domain registrar, IONOS) to the main `digital-marketing-member-pages` Vercel project via `vercel domains add dm-dashboard.vintageinterior.co.uk digital-marketing-member-pages`. DNS configured at IONOS as a CNAME to Vercel's per-domain target (`70062ef793821419.vercel-dns-017.com`, a legacy `A` record to `76.76.21.21` also confirmed working). Verified live via `curl --resolve dm-dashboard.vintageinterior.co.uk:443:76.76.21.21 https://dm-dashboard.vintageinterior.co.uk/`. This is now the **permanent, primary link sent to the team**. Google trusts real registered/owned domains far more than shared platform subdomains — this is the actual, lasting fix, independent of whether the Search Console review ever completes.
4. **Team/HR communication** — drafted and the user sent announcement messages explaining the outage in simple terms and confirming the dashboard's return, iterated toward maximum simplicity per feedback.
5. **Old domain removed from the project** (same session, later): once the team moved to the new domain, ran `vercel alias rm digital-marketing-member-pages.vercel.app` to fully remove the flagged domain from the project. Confirmed old domain now returns 404; new domain returns 200.

## Files/config touched
- `reports/digital-marketing-member-pages/googlebb3d8c1bfef3e723.html` (new, git-tracked)
- Vercel project domain configuration for `digital-marketing-member-pages` (not git-tracked)
- IONOS DNS records for `vintageinterior.co.uk` (external, not git-tracked)
- `C:\Users\PC\OneDrive\Desktop\eod-public\` (untracked standalone project)

## Deployment
Custom domain confirmed live and serving the correct login page. Old `.vercel.app` domain confirmed removed (404). `eod-public` fallback confirmed live during the transition window.

**Manual Verification Required:** exact date/time this work was performed is inferred from session continuity and the same-day GSC verification-file commit (`43eb08e`, 08:46) — no other git-trackable timestamp exists for the domain/DNS work itself.

**Status:** PASS (permanent fix — custom domain — confirmed working)
**Reviewer:** Muguntha (pending review)
**Next step:** Search Console review request for the old domain still pending Google's response — low priority, monitor only.
