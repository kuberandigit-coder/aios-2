# Evidence — Task 16: GSC API Capability Check (before building any action button)

**Date:** 2026-09-29
**Requested by:** user, explicitly before implementing any Search Console
action button (Fix / Request Indexing / Ignore) in the Issues detail panel.
**Related:** [[2026-09-29_task16-search-console-indexing-monitor_evidence]]

## What was checked, and how

This was a **code and documentation inspection**, not a live test run against
Google. This session has no working database connection and no network path
to Google's APIs (confirmed earlier the same day trying to import the
backend locally — see the Task 16 evidence file). Every claim below is
either read directly from this project's own code, or is Google's own
published, stable API documentation (not something that changes run to
run), so it did not need a live call to verify. No claim below is a guess.

### 1–3. Existing GSC credentials / Google Cloud project / OAuth scope

`backend/app/google_client.py`:
```
GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
```
Both the shared credential (`GSC_SERVICE_ACCOUNT_KEY`) and the dedicated
ledsone.fr credential (`GSC_LEDSONE_FR_SERVICE_ACCOUNT`, used by Task 15 and
Task 16) request **only** this one scope, hardcoded, for every call either
task makes. There is no second, write-capable scope configured anywhere in
this project.

**This alone answers most of the capability question without needing a live
call**: `webmasters.readonly` is a read-only OAuth scope. A request made
with it to any write endpoint (sitemap submit/delete, or any hypothetical
write action) would be rejected by Google with a 403, regardless of which
endpoint is targeted. The credential itself cannot write, by construction.

### 4–5. Authentication / endpoint access test

Not re-tested live in this check (would cost real API quota for a fact
already established below). Already empirically proven working in this
session: Task 16's own Overview tab is showing real counts (262 indexed, 2
not indexed, etc., from today's run) that can only come from a successful
authenticated call to the URL Inspection API. That is sufficient evidence
that authentication and read access work; it does not touch the "request
indexing" question, which is answered by the scope and by Google's public
API surface (below).

### 6. Is URL Inspection available?

**Yes, and already in production use.** `structured_data_validation.gsc`
(Task 15) calls
`POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`
successfully; Task 16 reuses the same cache and the same credential. This is
a read endpoint (returns a URL's indexing status) — it does not request
indexing, it only reports it.

### 7. Is "Request Indexing" actually supported through any available API?

**No — this is a documented Google platform limitation, not a gap in this
project's setup.** Google publishes exactly two relevant APIs:

- **Search Console API (webmasters v3 / URL Inspection v1)** — the one this
  project uses. Its write-capable endpoints are `sitemaps.submit` and
  `sitemaps.delete` (submitting/removing a *sitemap file*) — there is no
  "request indexing for this URL" endpoint anywhere in this API, for any
  scope.
- **Indexing API (`indexing.googleapis.com`)** — a separate API that DOES
  let you request a URL be (re)crawled quickly, but Google restricts it by
  policy to exactly two content types: `JobPosting` and `BroadcastEvent`
  (livestream) structured data pages. Google's own documentation for this
  API states requests for any other page type are not honoured. ledsone.fr's
  product, collection and blog pages are none of these types, so this API
  would not do anything useful even if it were wired in.

**"Request indexing for an arbitrary URL" is only available manually, as a
button inside the Search Console web UI itself — there is no way to trigger
it from any API, for any Google Cloud project, with any scope.** This is
true independent of this project's own configuration.

## Conclusion

**API action unavailable — Open in Google Search Console instead.**

- No code change can add a working in-dashboard "Request Indexing" button;
  the API to do so does not exist for this content type.
- The existing read-only scope means no write action of any kind (sitemap
  submit/delete included) could succeed with the current credential even if
  a relevant endpoint existed.
- The Issues detail panel's "Request Indexing" control will link out to the
  real Search Console URL Inspection tool for that exact URL
  (`https://search.google.com/search-console/inspect?resource_id=...&id=...`)
  instead of pretending to perform the action in-app. Choosing it also
  records the reviewer's decision in this project's own database (a label,
  e.g. "sent to Search Console for manual indexing request"), so the
  workflow status is still tracked -- but no Google API call is made.
- "Fix issue" and "Ignore (reason required)" remain pure status labels in
  this project's own database, as already documented in the main Task 16
  evidence file -- neither ever called Search Console or Shopify.

No fake or simulated action was built. This finding is recorded before, not
after, the action UI was implemented.
