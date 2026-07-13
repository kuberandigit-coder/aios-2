---
date: 2026-07-13
staff: Kamsi
requirement: Requirement 2 — live GSC dashboard
type: validation
---

# Kamsi Req2 — Live GSC Dashboard — Validation

## Checklist

| Item | Status |
|---|---|
| Service-account auth verified against live GSC API (direct test query) | ✅ PASS |
| Serverless function `api/gsc-low-ctr.js` — `node --check` | ✅ PASS |
| Front-end `kamsi-req2-low-ctr-live.html` — div-balance (30/30) + `node --check` | ✅ PASS |
| Filters match existing static page's UX exactly (Flag/Page Type/CTR Range/date range/pagination) | ✅ PASS |
| Preview deployment tested before production (`...cfxslk03a.vercel.app`) | ✅ PASS |
| `GSC_SERVICE_ACCOUNT_KEY` added to Vercel Preview + Production env (never committed to git) | ✅ PASS |
| Production deployment verified live (API returns real data, page loads 200) | ✅ PASS |
| Date-picker max locked to "yesterday" not an artificial 3-day buffer (fixed after user feedback) | ✅ PASS |
| "Google confirmed data through" label added to avoid confusion when picker date has no data yet | ✅ PASS |
| "Live Dashboard" link added to static page, styled per multiple rounds of explicit user feedback | ✅ PASS |
| Both repos in sync (`aios-2`, `Staff-requirements`) | ✅ PASS |

## Known issues / recommendations

- API response has a 5-minute server-side cache header
  (`s-maxage=300, stale-while-revalidate=600`) to protect GSC quota — user
  was informed this means "live" is not literally a fresh Google API call
  on every single request within the same 5 minutes, though it always
  reflects current GSC data. No action needed unless quota usage becomes a
  concern.
- The two service-account keys on this PC were not both verified — only
  `ga4-service-account.json` was confirmed working and used.
  `ledsonede-gsc-7af8d5684e71.json` remains unverified; recommend
  confirming with the account owner whether it's still needed or can be
  retired, to avoid confusion in future work.
- GSC's own 2-3 day reporting lag is a hard platform limit, not fixable —
  documented clearly in the page's footnotes and in the AI Knowledge doc
  so future work doesn't re-investigate this as if it were a bug.
