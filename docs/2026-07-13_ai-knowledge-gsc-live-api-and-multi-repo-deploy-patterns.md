---
date: 2026-07-13
type: ai-knowledge
tags: [gsc-api, google-search-console, vercel, multi-repo-deploy, html-validation, thasitha, kamsi, jakshan, sonya]
---

# AI Knowledge — GSC Live API & Multi-Repo Deploy Patterns (2026-07-13)

Reusable knowledge captured while building the Kamsi Req2 live GSC dashboard,
the Thasitha hourly refresh routine, and fixing two production regressions
(Jakshan, Sonya). Read this before doing similar work.

## 1. Google Search Console API — service account access

- Two service-account key files exist on this PC:
  - `C:\Users\PC\.keys\ga4-service-account.json` —
    `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, project
    `aios-ga4-reader`. **Confirmed working** — granted access to the
    `sc-domain:ledsone.co.uk` GSC property (Restricted access) since
    2026-07-03. Use this one.
  - `ledsonede-gsc-7af8d5684e71.json` (repo root) —
    `ledsonede-gsc-reader@ledsonede-gsc.iam.gserviceaccount.com`, project
    `ledsonede-gsc`. Unverified whether it's actually granted GSC property
    access. Don't assume it works without testing first.
- Auth pattern (no `googleapis` npm package needed — plain JWT + fetch):
  build an RS256-signed JWT with `scope: https://www.googleapis.com/auth/webmasters.readonly`,
  POST to `https://oauth2.googleapis.com/token` with
  `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, use the returned
  `access_token` as a Bearer token against
  `https://www.googleapis.com/webmasters/v3/sites/{encoded-siteUrl}/searchAnalytics/query`.
  Full working implementation:
  `reports/digital-marketing-member-pages/api/gsc-low-ctr.js`.
- Site is a **Domain property** — query with `siteUrl` =
  `sc-domain:ledsone.co.uk` (not the https:// URL form).

## 2. GSC data has a real, unavoidable 2-3 day reporting lag

Confirmed empirically on 2026-07-13 by querying GSC directly for July 5–13,
broken down by day (`dimensions: ['date']`): **zero rows exist for July 11,
12, 13.** This is Google's own processing lag — visible in the GSC web UI
too, not something our pipeline or API calls can bypass. Implications:

- Never assume "live API query" means "today's data" — GSC never has
  same-day data, for anyone.
- When building a "live" GSC dashboard, request through **yesterday**
  (`today - 1 day`), not an arbitrary larger buffer — Google silently
  returns only what it actually has, so requesting a tight window doesn't
  error, it just means new data appears the moment Google publishes it
  instead of waiting an artificial extra buffer on top of Google's own lag.
- To report the *actual* confirmed latest date (for an honest UI label,
  since the requested end date and the real data cutoff differ), run a
  cheap secondary query with `dimensions: ['date']` over the same range and
  take `max(date)` from the returned rows — don't just report back the
  requested end date as if it were confirmed.
- If a user wants genuinely same-day/real-time data, that requires **GA4**
  (session/pageview data), not GSC — they measure different things
  (traffic/behavior vs. search performance) and can't be merged into one
  "live CTR" metric.

## 3. Multi-repo deploy risk: `vercel --prod` deploys local disk, not git

This project's Vercel deployment (`digital-marketing-member-pages`) has Git
integration pointed at `digitalmarketing69140951-sys/Staff-requirements`
(confirmed via `vercel git connect` — "already connected"), **but** manual
`vercel --prod` CLI deploys run from the `aios-2` local checkout
(`reports/digital-marketing-member-pages/`), which is a **separate,
sometimes out-of-sync copy** of the same site content.

**This caused a real regression on 2026-07-13**: another contributor
(Piranav) pushed a 511-line live update to `jakshan.html` directly to
`Staff-requirements` (which auto-deployed via Git integration). Minutes
later, a manual `vercel --prod` was run from the `aios-2` local checkout to
publish unrelated Kamsi/Thasitha changes — since the local `aios-2` copy of
`jakshan.html` was still the old 24-line stub, the manual deploy silently
overwrote Piranav's live version.

**Rule going forward**: before any `vercel --prod` deploy of this shared
project, `git fetch`/diff the `Staff-requirements` clone for files this
session hasn't touched, and sync any changes into the local `aios-2` copy
first — otherwise a deploy meant to publish one page can silently regress
someone else's unrelated page. This is the same reason the earlier
Thasitha/Kamsi work always mirrors changes into a clone of
`Staff-requirements` before considering a task complete.

## 4. Validating large merged multi-tab HTML files before deploying

Several member-page files (`kamsi-req1-slow-moving-products.html`,
`jakshan.html`, `sonya.html`) are single HTML files merging multiple
requirement tabs, sometimes 500+ lines, sometimes too large for a plain
line-range `Read` (hit the 25k-token cap). Reusable validation approach used
repeatedly this session:

```js
// track <div>/</div> depth line-by-line; final depth must be 0
const opens = (line.match(/<div/g) || []).length;
const closes = (line.match(/<\/div>/g) || []).length;
depth += opens - closes;
```

This caught two real, independently-introduced bugs today (Jakshan's
missing `req1-section` close, Sonya's leftover Trend-tab stub with 2 extra
closes) — both from other contributors' commits, neither would have been
caught by just opening the page and glancing at it, since the *visible*
tab still rendered fine; only switching to certain tabs or later DOM
operations would expose the imbalance. **Always run this check on any
merged multi-tab page before deploying**, including on files you didn't
author yourself (they may already be broken when pulled from another repo).

Scratchpad script used: `validate_thasitha.js` / `find_div_imbalance.js` in
this session's scratchpad — reusable pattern, not project-specific despite
the filename.

## 5. Scoping git commits/pushes carefully in multi-tool sessions

When syncing ported files (scripts, GitHub Actions workflows) from another
repo's clone into `aios-2` (a public repo), always read the actual file
contents first to check for embedded credentials before committing —
even if the files "look like infrastructure." In this session, a
Jackshan auto-update GitHub Actions workflow + Python script were pulled in
from `Staff-requirements`; verified clean (credentials sourced from
`os.environ`/GitHub Secrets only, no hardcoded keys) before it would have
been safe to push — but the push was correctly scoped back to only the
files the user actually asked about (`sonya.html`, `jakshan.html`) since
mirroring unrelated automation infrastructure into the public repo wasn't
explicitly requested.
