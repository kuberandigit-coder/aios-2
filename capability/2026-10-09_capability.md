# Capability — 2026-10-09

## Capability — Building a Dev-Task Page Fully From Existing Conventions, With an Honest "Not Yet Computable" State

**Date:** 2026-10-09
**Owner:** Kuberan (dm-dashboard, Shopify Price Check — Final Price vs Current Shopify Price)
**Status:** Backend live-verified against real data; frontend build-verified

### Capability (a reusable pattern, not a feature)

A new dev-task page was added entirely by discovering and reusing the repo's existing conventions
(dev_tasks package shape, `task_auth.make_task_auth`, `devTasksRegistry.js`/`taskRegistry.js`
single-source-of-truth lists, `jreq-*` CSS, singleton-JSONB-snapshot persistence pattern from
`meta_audit/schema.py`) rather than inventing a parallel structure. Zero new auth system, zero new
CSS, zero new nav mechanism.

### Reusable lesson

**When a calculation's required inputs are provably absent from every available data source, the
correct behavior is to compute and surface that absence explicitly per-record (`MISSING_INPUT` +
a stated reason) — never to silently substitute a default (e.g. 0%) that would make incomplete
output look complete.** This remains correct and was re-confirmed the same day for the 266 SKUs
whose category still has no PPC rate (see below) — those are still correctly flagged, not defaulted.

### CORRECTION, same day — "no PPC source exists" was a false negative from an incomplete search

The claim above originally said "no category-wise PPC-rate table exists in either business
database." **That was wrong.** A follow-up diagnosis (same day) found `blos.account_ppc_settings`
in business DB 2 — a real, human-maintained category-wise PPC rate table (310 rows for
`platform='shopify-uk'`, `updated_by='admin'`, dated as recently as 2026-10-06). The first search
missed it because it grepped column names like `%fee%`/`%rate%`/`%cost%` but never literally
searched for `%ppc%` as a column/table substring **inside business DB 2 specifically** (it was
checked in DB 1, and a long schema listing from DB 2 had actually printed `account_ppc_settings`
earlier in the session — just never opened and read).

**Reusable lesson:** when told "search for X," search for the literal term as a column/table name
substring directly (`ILIKE '%ppc%'`), not just semantically-adjacent names you expect to find it
under. And re-open and actually read every table name a broad schema listing surfaces that matches
the thing you're looking for — don't let a match scroll past in a long listing unexamined.

### A second, narrower fact worth keeping: Balance Price lives in a second business database

`blos.listing_channel_price_v1` (database `order_management_copy`, a different Postgres instance
from the main `ledsone` business DB already wired into this app) holds a real, actively-synced
"Balance Price" (`recommended_price`) for 732 of 1,808 Shopify UK SKUs — confirmed by direct query,
not assumed. The main `ledsone` business DB has no equivalent table at all. A second optional DB
pool (`BUSINESS_DATABASE_2_URL`, `get_business2_conn()`) was added to `core/db.py`, kept separate
from the required `BUSINESS_DATABASE_URL` pool so the app still boots if it's unset.

### Originating task

`evidence/dm-dashboard/2026-10-09_shopify-price-check-page_evidence.md`
`evidence/dm-dashboard/2026-10-09_shopify-price-check-ppc-source-fix_evidence.md`
