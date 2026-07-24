# Capability — Shopify Access-Scope Error Diagnosis + Unbounded-Scan Timeout Guard

**Date:** 2026-07-24
**Owner:** Kuberan
**Staff/Requirement:** Kamsi Req1
**Store/Project:** digital-marketing-member-pages / ledsone.co.uk (UK)
**Status:** Completed

## Capability
Diagnose and fix a Shopify Admin GraphQL "Access denied for X field" error by identifying and removing unused fields that require scopes the token doesn't have, and prevent full-catalog scans from hanging indefinitely with no user feedback.

## What Was Implemented
- Removed an unused `location {id name}` field from an inventory query that was requesting a scope (`read_locations`/`read_markets_home`) not granted to the UK token, even though the field's data was never consumed.
- Added a 10-minute in-memory server-side cache (bypassable with `?refresh=1`) to a handler that otherwise re-scanned the full 13,866-SKU catalog (~278 paginated GraphQL calls) plus a 90-day order history on every click.
- Added a client-side 290s `AbortController` timeout so a hung request surfaces a clear error instead of an infinite spinner.

## Technical Knowledge
- Shopify Admin GraphQL returns a field-level "Access denied" error (not a request-level 401/403) when a query includes a field requiring a scope the access token lacks — the rest of the query can still be valid. Diagnosis: check which requested fields are actually used downstream before assuming the whole endpoint needs new scopes.
- A hang with zero bytes returned after 100+s is confirmable directly via a bare curl call against the endpoint — a fast, cheap way to distinguish "slow" from "the client is blocking on an error/retry storm" before adding speculative fixes.
- Shopify applies per-page cost throttling (exponential backoff, up to 6 retries/page) on large paginated scans — this compounds badly with wide catalogs (13k+ SKUs) and no caching.

## Important Rules / Logic
- Any GraphQL field requested but not consumed by the response handler is a liability (extra scope requirement, extra payload) — audit and remove.
- Full-catalog/full-history scans on user-triggered buttons need both a server-side cache floor (so repeat clicks are cheap) and a client-side timeout ceiling (so failures are visible, not silent).

## Files / Components
- `reports/digital-marketing-member-pages/api/requirement.js`
- `reports/digital-marketing-member-pages/pages/kamsi.html`

## Data Sources / Tools
Shopify Admin GraphQL API, `ledsone.co.uk` (UK token).

## Validation
Reconstructed from commit messages `f6cd3ad`, `5e3408b` — not independently re-tested live in this sync.

## Reuse
Applicable to any other requirement page hitting a similar "Access denied for [field]" error, or any button-triggered full-catalog scan with no existing cache/timeout guard.

## Evidence
`evidence/Kamsi/2026-07-24_kamsi-req1-access-scope-hang-fixes.md`

## Limitations
The 10-minute cache means a genuinely fresh change on Shopify's side won't show up for up to 10 minutes without an explicit `?refresh=1`.
