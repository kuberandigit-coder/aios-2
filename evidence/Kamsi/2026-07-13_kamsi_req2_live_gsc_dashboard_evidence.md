---
date: 2026-07-13
staff: Kamsi
requirement: Requirement 2 — Low CTR Page Identification
type: evidence
---

# Kamsi Req2 — Live GSC Dashboard — Evidence

## Purpose

The existing static Req2 tab (`kamsi-req1-slow-moving-products.html`) was a
one-time snapshot frozen at "Last updated: 2026-07-08" with a fixed
2026-01-01 to 2026-06-30 range. Build a live-updating version that queries
GSC directly.

## Existing AIOS assets found before building

- `evidence/Kamsi/2026-07-03_kamsi_req2_low_ctr_evidence.md` — original
  static build.
- `reports/Kamsi/data/2026-07-03_kamsi_req2_gsc_fetch.py` — original
  one-time fetch script (Python, not reused; new build queries live via
  serverless function instead).
- Memory: `project_gsc_connection_setup.md` — documented the GA4
  service-account reuse pattern for GSC access, confirmed working since
  2026-07-03.

## Google Search Console API evidence

Verified live query against `sc-domain:ledsone.co.uk` using
`C:\Users\PC\.keys\ga4-service-account.json`:
```
POST https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aledsone.co.uk/searchAnalytics/query
{"startDate":"2026-06-01","endDate":"2026-06-30","dimensions":["page"],"rowLimit":5}
→ HTTP 200, real rows returned (ledsone.co.uk homepage, blog pages, etc.)
```
Full handler test (30-day window): 1,438 in-scope pages, 594,793
impressions, 1,946 clicks, avg CTR 0.33%.

## Files created

- `reports/digital-marketing-member-pages/api/gsc-low-ctr.js` — serverless
  function. JWT auth (RS256, `webmasters.readonly` scope), paginated
  `searchAnalytics.query` (25k row batches), scope filter
  (`/collections/`, `/blogs/`, `/blog/`), CTR/low-CTR computation
  (threshold 2%), plus a secondary `dimensions:['date']` query to report
  the *actual* Google-confirmed latest date separately from the requested
  range (see AI Knowledge doc for why).
- `reports/digital-marketing-member-pages/pages/kamsi-req2-low-ctr-live.html`
  — front-end. Filters matched exactly to the existing static page's UX:
  Flag (All/Low CTR/OK), Page Type (All/Collection/Blog), CTR Range
  (All/0%/0-1%/1-2%/2-5%/5%+), date-range picker with "Clear (Full Range)",
  pagination (50/100/250/500 rows, prev/next/first/last).

## Files modified

- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
  — added a "Live Dashboard" chip link (Req2 tab header chip row) to the
  new live page. Iterated through 4 design rounds based on direct user
  feedback (floating card → repositioned → arrow removed → reverted to a
  plain chip matching the existing chip row design language → distinct
  green color to signal "live" at rest, not just on hover → shortened
  "Source" chip text + tightened row so all 4 chips fit on one line).

## Vercel environment configuration

- `GSC_SERVICE_ACCOUNT_KEY` added as an encrypted Vercel env var — scoped
  to **Preview** first (tested via preview deploy
  `digital-marketing-member-pages-cfxslk03a.vercel.app`), then also added
  to **Production** before promoting.
- `vercel dev` (local dev server) could not be made to pass the env var
  through to its function sandbox despite 3 different approaches
  (`.env.local`, restart, direct shell export) — abandoned as a known CLI
  quirk in favor of testing against a real preview deployment instead,
  which worked correctly.

## Deployment evidence

- Preview verified: `https://digital-marketing-member-pages-cfxslk03a.vercel.app/pages/kamsi-req2-low-ctr-live.html`
- Production verified: `https://digital-marketing-member-pages.vercel.app/pages/kamsi-req2-low-ctr-live.html`
  and `.../pages/kamsi-req1-slow-moving-products.html` (Live Dashboard chip)
- API confirmed live in production:
  `{"summary":{"totalPages":4324,...},"dateRange":{"start":"2026-01-13","end":"2026-07-12","requested":"2026-07-12","latestAvailable":"2026-07-10"}}`
- Repos: `aios-2@2feeb2c`, `Staff-requirements@9fb5fb2`/`2929e0d` (merge)
