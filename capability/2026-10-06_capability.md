# Capabilities — 2026-10-06

## Capability — Live-API-vs-External-DB Verification Discipline

**Date:** 2026-10-06
**Owner:** Kuberan (Blog Optimization GSC migration)
**Project:** dm-dashboard
**Status:** Complete and live, 3 of 8 sites in scope

### Capability

When asked which data sources actually have working access, **test the real API directly for
every candidate, don't infer from what an external database happens to contain.** The business
database here had broader site coverage than this app's own GSC credentials — confirmed only by
a live test script calling the real API for all 8 sites plus a direct `requests.post` test of the
dedicated service account, which found exactly 3 of 8 sites actually accessible (`ledsone.co.uk`,
`ledsone.de`, `ledsone.fr`) and 5 returning HTTP 403. This 3-of-8 result shaped the whole task's
scope honestly, rather than building against data the app can't actually fetch itself.

### Reusable bug class — mixed int/float types from a JSON API breaking a bulk upsert

**Every site silently wrote 0 rows on the first scheduled run**, with the sync still reporting
"success" — the error was caught per-site and swallowed. Root cause: GSC's API returns `ctr`/
`position` as a mix of JSON ints and floats within the same response (a `0` ctr comes back as an
int, others as floats); psycopg's `unnest()` array dump rejects a Python list containing mixed
types. **Fix: coerce every such numeric field to `float()` explicitly before building the array**
— a reusable defensive step for any future bulk-upsert pipeline ingesting an external JSON API's
numeric fields.

### Reusable gotcha — two separate places control "does this appear in Sync Monitor's sidebar"

A new Sync Monitor entry didn't appear after a confirmed-live deploy. The assumption that
`SalesSyncMonitor.jsx`'s `SCHEDULED_SNAPSHOT_TABS`/`SCHEDULED_SNAPSHOT_LABELS` maps controlled
sidebar visibility was wrong — **they only control scope-filtering once you're already on that
page.** The actual sidebar menu entry is a second, separate hardcoded array in `DevLayout.jsx`.
Confirmed via direct `curl` of the deployed CSS/JS bundles (ruling out stale cache) before
concluding it was a real code gap. Related to `2026-10-02_capability.md`'s sidebar 3-way-
duplication finding — check both when a new dev task doesn't show up where expected.

### Reusable technique — common-prefix/common-suffix diffing for a single-region HTML fix

"Locate Changes" (show exactly what a fix changed) computes the differing span between a fix's
before/after HTML using simple common-prefix/common-suffix matching — sufficient and much lighter
than a full diff library, confirmed correct **because every fix in this system only inserts or
replaces one contiguous region** (duplicate-link removal, heading renumbering, FAQ schema
append) — a reusable shortcut specifically when that single-region assumption genuinely holds,
not a general-purpose diff algorithm.

### Originating task

`closure/dm-dashboard/2026-10-06_blog-optimization-gsc-live-api-migration_closure.md`

### Known limitation (not fixed, correctly flagged rather than worked around)

`ledsone.de`'s Shopify content features are blocked on a missing `read_content` scope on its
Admin API token — a permissions grant only the business owner can make, not a code fix.
