---
date: 2026-07-13
staff: Kamsi
requirement: Requirement 2 — live GSC dashboard
type: handover
---

# Kamsi Req2 — Live GSC Dashboard — Handover

## Completed

- New live-query dashboard built and deployed:
  `pages/kamsi-req2-low-ctr-live.html` + `api/gsc-low-ctr.js`.
- Uses `C:\Users\PC\.keys\ga4-service-account.json` (confirmed working GSC
  service account) — stored as Vercel env var `GSC_SERVICE_ACCOUNT_KEY`
  (Preview + Production), never committed.
- Filters/pagination match the existing static page's UX exactly.
- Date range now always requests through yesterday (fixed an earlier
  artificial 3-day lag buffer) and separately reports Google's actual
  confirmed data date.
- "Live Dashboard" chip link added to the static page
  (`kamsi-req1-slow-moving-products.html`).
- Both repos and production verified in sync.

## Remaining work

- Nothing outstanding for the core requirement.
- Not built: a same-day/real-time GA4 companion panel was discussed
  (since GSC can never show same-day data) but not requested/built.

## Risks / assumptions

- The unverified second GSC key (`ledsonede-gsc-7af8d5684e71.json`) was
  not touched or relied upon — if it turns out to be needed for something
  else, confirm its actual grant status before use.
- API responses cache for 5 minutes server-side (quota protection) — not
  a bug, but worth knowing if someone expects literal per-request live
  calls.

## Next actions

- None required. If usage grows, consider whether the 5-minute cache
  window needs adjusting.
