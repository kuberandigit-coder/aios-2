# Evidence — Session-Expired / Server-Unavailable UX Fix (dm-dashboard)

**Date:** 2026-10-09
**Project:** dm-dashboard
**Requested by:** Kuberan — raw 401/502 error codes were showing directly to users when a
session expired or the backend briefly restarted.

## Investigation

Searched for every place a raw HTTP status code reached the user: found 10+ pages each
independently doing `throw new Error(\`Request failed (${res.status})\`)` or
`${res.status} ${res.statusText}` and rendering that string as the page's own error message —
`AdsProductScope.jsx`, `AltTextKeywordFinder.jsx`, `BlogHtmlAutomation.jsx`,
`BlogOptimization.jsx`, `ContentGapAnalysis.jsx`, `FrenchKeywordResearch.jsx`,
`GeoVisibility.jsx`, `Gsc404UrlMonitor.jsx`, `InternalLinkingSuggestionEngine.jsx`, and more.
Confirmed every one of these goes through the single shared `apiFetch` wrapper
(`frontend/src/lib/apiFetch.js`) — the one touch point to fix this centrally instead of editing
every page.

## Fix

- `apiFetch.js`: on a 401 response, clears the stored token and dispatches a global
  `dm:session-expired` browser event (de-duplicated so a burst of parallel 401s only fires once).
  On 502/503/504, dispatches `dm:server-unavailable` instead. The returned `Response` object is
  unchanged either way — every existing page's own `res.ok` handling keeps working exactly as
  before; this adds a global layer on top, not a replacement.
- `App.jsx`: listens for both events. `session-expired` forces a clean logout (same cleanup as
  the existing logout button) and shows "Your session has expired. Please sign in again." on the
  login screen — the user never sees whatever page was mid-request, since the whole app
  re-renders to the login screen immediately. `server-unavailable` shows a small, dismissible
  banner at the top of the screen without logging the user out (the session is still valid, only
  the server is briefly down).

## Validation

Full `npx vite build` — clean, no new errors/warnings. No live click-through from this session
(no browser/server access) — flagged as the one remaining check.

## Files changed

`frontend/src/lib/apiFetch.js`, `frontend/src/App.jsx`. Commit `f785ce2`, pushed to `dev-work`.

## Status

**Fixed and pushed.** Not yet merged to `main`, not yet deployed/live-verified.
