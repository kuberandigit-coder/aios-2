# Capabilities — 2026-07-22

---

# Capability — Vercel Serverless Function Consolidation (Query-Param Dispatch)

**Date:** 2026-07-22
**Owner:** Kuberan
**Project:** `reports/digital-marketing-member-pages` (Vercel Hobby plan)
**Status:** Active, in continuous use

## Capability

Keep an unlimited number of logically-separate API endpoints running on Vercel's Hobby-plan
12-serverless-function cap by merging many original handler files into a small, fixed number of
base files (`api/sales.js`, `api/requirement.js`), each dispatching internally on a query
parameter (`?entity=...` or `?fn=...`) to an isolated, originally-independent handler — instead of
adding a new `.js` file (and therefore a new serverless function) for every new staff
requirement/report.

## What problem it solves

A push to the connected `Staff-requirements` GitHub repo failed to auto-deploy once the project
grew to 15 separate API files — Vercel's Hobby plan hard-caps serverless functions at 12. Every
staff requirement/report had historically been given its own new `.js` file, which is not
sustainable long-term on this plan.

## Originating task

`evidence/shopify_sales/2026-07-22_api-consolidation-15-to-2-files-evidence.md` — merged 15 files
down to 2 (`sales.js`, `requirement.js`) the same day the 12-function cap first caused a failed
deploy.

## Technical implementation

1. Each source file independently declared identically-named top-level helpers
   (`STORE_DOMAIN`, `TOKEN`, `sleep`, `shopifyGraphQL`, `base64url`, `getAccessToken`, etc.) — a
   naive text concatenation throws `SyntaxError: Identifier has already been declared`.
2. Fix: wrap each original file's entire content in its own IIFE
   (`const xHandlerModule = (function() { ...entire original file...; return xHandler; })();`),
   isolating every top-level declaration into that closure's private scope, and rename its
   exported handler to a uniquely-named local function first.
3. Insert the wrapped module into the target base file, after its `require()` lines.
4. Add dispatch logic at the very top of the base file's own exported handler: a new query param
   routes to the matching wrapped handler; **no param falls through to the base file's own
   original logic unchanged** — this preserves every existing caller's URL with zero change.
5. For a large merge (4,600+ combined lines), write a small Node script to do steps 1-4
   mechanically rather than hand-editing.

## Dispatch convention established

- `api/sales.js` — `?entity=<name>` (e.g. `dilaksi`, `jackson`, `kamsi`, `sukirtha-uk`); no
  `entity` param preserves the original `?staff=...` behavior.
- `api/requirement.js` — `?fn=<name>` (e.g. `check-urls`, `kamsi-live`, `req2-req3`,
  `req4-ga4-seo`, `jefri-product-status`, `jefri-req3`, `sukirtha-r6`); no `fn` param preserves
  the original `?store=uk|de` behavior.
- New requirements since the original merge have **continued to be added as new `?fn=`/`?entity=`
  values inside these same 2 files**, not as new top-level `.js` files — confirmed by direct grep
  across 35 later task records (jefri req1-7, mahima req3/req5, dilaksi req2-4, Kamsi req4,
  thasitha req1/2/3/6, sukirtha R6, salesuk) that all reference this dispatch pattern.

## Validation performed at the originating task

`node --check` on both merged files; a local mock `req`/`res` dispatch test confirming every
entity/fn value reaches its own distinct logic (not a collision or wrong-handler route); live
post-deploy verification of representative routes returning HTTP 200 with correct data.

## Important business rule

**`vercel.json`'s `functions` block must be kept in sync** whenever a file is added/removed/
renamed — this was updated twice during the original consolidation as files were removed.

## Dependencies

Vercel Hobby plan's 12-function limit (the reason this pattern exists at all); the two base files
must stay the only two API entry points for this project unless the plan changes.

## Reuse

Any future staff requirement/report for this project should be added as a new dispatch value
inside the existing `sales.js`/`requirement.js`, never as a new top-level API file — this is the
standing convention, not a one-time fix. The IIFE-wrapping technique itself (isolate a whole file's
top-level scope, rename its handler, dispatch by query param) is also reusable for any other
Node/Vercel project facing the same per-file-function-count constraint.

## Evidence

`evidence/shopify_sales/2026-07-22_api-consolidation-15-to-2-files-evidence.md`

## Where it is used (confirmed via grep, not exhaustive)

`evidence/jefri/2026-07-22_req2-search-terms-labels-evidence.md`,
`2026-07-24_req3-3period-comparison-evidence.md`, `2026-08-12_req5-cross-campaign-attribution-evidence.md`,
`2026-08-13_requirement-5-cross-repo-sync-bug-and-permanent-fix.md`,
`2026-08-14_req6-image-update-live-sales-tracker.md`, `2026-08-19_req7-bq-amazon-shopify-reconciliation.md`;
`evidence/mahima/2026-07-23_req3-search-terms-live-relocation.md`,
`2026-07-29_requirement-5-product-id-coverage-evidence.md`;
`evidence/dilaksi/2026-07-23_req3-live-attempt-reverted.md`, `2026-07-24_req2-indexeddb-persistence.md`,
`2026-08-24_dilaksi_req4_content_gap_evidence.md`;
`evidence/Kamsi/2026-07-23_kamsi-req4-live-summary-cards.md`;
`evidence/thasitha/2026-07-28_requirement-1-live-refresh-evidence.md`,
`2026-07-28_requirement-3-live-refresh-evidence.md`, `2026-07-29_requirement-2-live-refresh-evidence.md`,
`2026-08-10_requirement-6-keyword-seo-gap-discovery.md`;
`evidence/sukirtha/SUK-R6-field-mapping.md`, `SUK-R6-shopify-source-map.md`;
`evidence/salesuk/2026-08-24_tiktok-august-uk-first-session-check.md`.

## Limitations

This capability record was written retroactively (2026-10-08, AIOS full capability backfill) from
the originating evidence file plus a grep-based cross-reference of later usage — the 35 usage
references above were found by searching for the string `fn=`/`entity=` across existing evidence/
handover docs, not by individually re-reading each one in full. The pattern's continued correct
use in each of those tasks is therefore NOT individually re-verified by this record; it relies on
each task's own evidence/validation already having passed at the time.

