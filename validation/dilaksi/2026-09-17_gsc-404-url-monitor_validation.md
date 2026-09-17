# Validation — GSC 404 URL Monitor (Dilaksi)

**Date:** 2026-09-17
**Overall status: PARTIAL** — code complete, compiles/builds clean,
architecturally correct and reusing all required existing systems; NOT
live-tested end to end, per explicit instruction not to run anything
inside the Claude session ("we will run in the system").

## Checklist (per the original prompt's 20-point test list + the mandatory AIOS validation points)

| # | Check | Result |
|---|---|---|
| 1 | Existing GSC integration still works | Not broken — `query_gsc`/`get_gsc_access_token` untouched, only a new function (`inspect_url`) added alongside |
| 2 | Authentication works | Reuses existing `GSC_SERVICE_ACCOUNT_KEY` token exchange — not independently re-tested live this session (would require running the app) |
| 3 | Correct property is used | `sc-domain:ledsone.co.uk` reused from the existing `GSC_SITE_URL` convention already used by `dilaksi.py`/`kamsi.py` |
| 4 | No secrets appear in responses/logs | Confirmed by code review — no credential value is ever logged, returned, or written to Postgres/AIOS |
| 5 | GSC API capability correctly identified | Confirmed: no bulk 404 endpoint exists; `urlInspection.index:inspect` is the closest real alternative — see evidence doc §2 |
| 6 | No fake GSC 404 endpoint implemented | Confirmed — `source` column is literally `'gsc_url_inspection'`, never claims to be the Page Indexing report |
| 7 | 404 URLs deduplicated correctly | `UNIQUE (property, normalized_url)` + `ON CONFLICT ... DO UPDATE` in `schema.py` — logic reviewed, not live-exercised against real duplicate data yet |
| 8 | Original URL preserved | `original_url` column stores the exact GSC-reported URL; `normalized_url` is a separate column used only for the unique constraint |
| 9 | Shopify matching works | Two-signal matcher implemented (handle-suffix exact match, then token-overlap search) — logic reviewed, not live-exercised against a real 404 URL yet |
| 10 | Match confidence calculated consistently | Deterministic: 95 for exact handle-suffix match, `round(Jaccard overlap * 100)` otherwise, `None` below the 40% floor |
| 11 | No replacement returned when evidence insufficient | Confirmed in code — `find_shopify_replacement` returns `suggestedUrl: None` explicitly on every "no good candidate" path |
| 12 | Search Analytics metrics mapped correctly | `fetch_gsc_context_by_path` reuses the exact same aggregation shape as the (now-removed) `broken_link_monitor`'s `enrich.py`, itself modeled on `meta_audit`'s established pattern |
| 13 | GA4 metrics mapped correctly | `fetch_ga4_sessions_by_path` is a direct reuse of the same established pattern, organic-only filter included |
| 14 | Priority logic works | Deterministic 4-tier rule documented in `enrich.compute_priority`'s own docstring — reviewed, not live-exercised |
| 15 | Filters work | Implemented client-side in `Gsc404UrlMonitor.jsx` (priority/review-status/replacement/search) — not manually clicked through in a browser this session |
| 16 | Review status updates work | `PATCH /issues/{id}/review` + `/development` implemented, validates against the fixed status list, returns 400 on an unknown value — not live-clicked |
| 17 | UAM works | Registered as `tools.DevGsc404UrlMonitor` in `taskRegistry.js`, same grant-based (no `ownerStaffKey`) pattern as every sibling Development Task — not live-tested with a real staff login |
| 18 | Existing dashboard pages still work | No existing file's *behavior* was changed, only additive lines (new imports/entries) — `npx vite build` succeeded with no new errors |
| 19 | Existing GSC functionality not broken | `query_gsc`, `dilaksi.py`, `kamsi.py`, `meta_audit`'s GSC usage are all untouched code paths |
| 20 | No unrelated files/functions changed | Confirmed via `git status`/diff review before commit — only the files listed in the evidence doc's §5 |

## Mandatory AIOS validation points (section 18)

- Correct source used — YES (GSC URL Inspection, not searchAnalytics mislabeled)
- API capability verified — YES, documented in evidence §2
- No fabricated GSC endpoint — YES
- Existing assets checked before building — YES (evidence §1)
- No duplicate implementation — YES; the two same-day prior attempts
  (Screaming Frog-based, then a first GSC-based pass) were both
  explicitly removed before this final version was built, and their
  AIOS records updated rather than left stale (see capability +
  source-map updates)
- No secrets exposed — YES
- Shopify matching implemented — YES (logic-reviewed, not live-tested)
- Evidence saved — YES, this session
- AIOS updated — YES, this session
- Existing functionality preserved — YES, `vite build` + `py_compile` both pass

## Why this is PARTIAL, not PASS

The user explicitly instructed: "dont run anything in claude we will
run in the system for gather 404 data in gsc using gsc api in the
system write all code and files and push to dev work." No live scan,
no live Shopify match, no live UAM click-through, and no live Sync
Monitor "Run Now" were performed in this session by design. Everything
above marked "not live-exercised" is a code-review-level confirmation,
not a live-system confirmation. This should be upgraded to PASS once
the scan is actually run in the deployed system and its real output is
reviewed.

## Reviewer / Next step

**Owner:** Claude (this session), on Kuberan's instruction, for Dilaksi
**Reviewer:** Kuberan / Dilaksi, once deployed
**Next step:** merge `dev-work` → `main`, deploy, trigger a Sync Monitor
"Run Now" for scope `gsc-404-monitor`, and confirm real rows appear in
the GSC 404 URL Monitor page with plausible Shopify matches and
priorities.
