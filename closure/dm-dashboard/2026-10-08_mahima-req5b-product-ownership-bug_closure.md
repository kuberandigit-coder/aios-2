# Closure — Mahima Req5b: Wrong Product-Ownership Rule Fixed

**Date:** 2026-10-08
**Project:** dm-dashboard

## What was done

Found and fixed a real bug: Req5b ("Product × Campaign Sales") was showing products that aren't
Mahima's, because it defined ownership via a different, older, flawed rule (campaign-spend-derived)
than the already-correct tag-based rule `/req5` uses. Unified both endpoints onto the same
authoritative source (`_get_mahi_ft_product_ids()`, the real Shopify `Mahi-ft` tag).

See `evidence/dm-dashboard/2026-10-08_mahima-req5b-product-ownership-bug_evidence.md` for the full
investigation.

## Status

**Fixed and pushed to `dev-work`** (commit `1af4327`). Not yet merged to `main`. The page's cached
snapshot still needs a fresh sync (Run Now) after deploy to clear the stale, incorrectly-scoped
data — flagged as the one remaining step, not yet done.

## Next step

- Merge `dev-work` → `main` via Dev Tools.
- Trigger `POST /api/mahima/req5b/sync/run-now` after deploy.
- Confirm live that product `5481828778151` no longer appears on the Req5b page.
