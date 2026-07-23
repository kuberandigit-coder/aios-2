# 2026-07-23 — Jefri Req2 Search-Terms Cache + Refresh Button

## What happened
Follow-up perf fix for Jefri's Requirement 2 Search Terms page (`pages/jefri.html`), built on top of the 2026-07-22 Req2 launch. Endpoint `jefriSearchTermsHandler` in `api/requirement.js` returns 50k+ rows and was taking ~10s uncached on every request.

## Changes
- `api/requirement.js`: new `JEFRI_CACHE2` Map, 60s TTL, `?refresh=1` bypass — mirrors the existing Req1 cache pattern but kept in its own Map.
- `pages/jefri.html`: CSS only — `#r2RefreshBtn` added to the shared `.tbar button, #refreshBtn` styling rule.

## Status
Reviewed via diff (PASS). Not yet deployed/live-tested this session.

## Links
- Evidence: `evidence/jefri/2026-07-23_req2-search-terms-cache-refresh-btn-evidence.md`
- Validation: `validation/jefri/2026-07-23_req2-search-terms-cache-refresh-btn-validation.md`
- Closure: `closure/jefri/2026-07-23_req2-search-terms-cache-refresh-btn-closure.md`
