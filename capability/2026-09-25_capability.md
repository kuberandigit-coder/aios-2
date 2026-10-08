# Capabilities — 2026-09-25

## Capability — Structured Data Validation Pipeline (Task 15)

**Date:** 2026-09-25
**Owner:** Hetheesha (built by Kuberan)
**Project:** dm-dashboard, ledsone.fr
**Status:** Implementation Complete — Manual Verification Pending, not deployed, not committed in
`dm-dashboard` (left for review), no closure record yet

### Capability

Discovers every URL in a store's public sitemap, extracts JSON-LD/microdata/RDFa from each, cross-
validates it against **live Shopify data** (not just internal consistency), adds a bounded Google
Search Console URL Inspection sample, and tracks fixes through a re-validation workflow whose state
survives every new pipeline run.

### Reusable issue-tracking pattern

**Issue key = normalized URL + schema type + field + issue code** — state and history live in
separate tables from the run data, so an issue's status (Fix required / Ready for recheck / Failed
/ Passed) persists correctly even as new pipeline runs re-discover the same issue. Re-validation
logic: a still-present issue becomes FAILED, a gone issue becomes PASSED, and **a failed fetch
never marks anything PASSED** — a reusable safety rule against false-positive "fixed" states caused
by a transient network error rather than an actual fix.

### Priority rules

HIGH = missing/invalid Product schema, wrong price/currency/availability, duplicate/conflicting
Product schema. MEDIUM = important Merchant warnings and missing eligibility fields. LOW =
recommended fields.

### GSC integration (shared quota, bounded sampling)

`searchconsole.googleapis.com/v1/urlInspection/index:inspect`, default 100 URLs per run
(configurable), HIGH-issue URLs sampled first, then a rotating sample per template, 24h cache,
stops cleanly on quota exhaustion rather than erroring. This is the same GSC inspection table/quota
later reused by Hetheesha's Task 16 (`2026-09-29_capability.md`) — confirmed by that capability's
own "Reuse" section.

### Originating task

`handover/hetheesha/2026-09-25_task15-structured-data-validation_handover.md`

### Related

`2026-09-29_capability.md` (Task 16, the Search Console Indexing Monitor, directly reuses this
task's GSC inspection table and quota).
