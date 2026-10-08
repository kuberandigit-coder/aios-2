# Capabilities — 2026-09-11

## Capability — Content Gap Analysis Pattern (Competitor Search Engine)

**Date:** 2026-09-11
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Live, major new feature (~12 commits this day alone)

### Capability

A competitor-search engine for finding and comparing content against competitor pages, with:
multi-candidate search (tries several search candidates, not just the first result), a quota/
cooldown system shared across multiple-competitors-per-click, a denylist for confirmed false
matches (e.g. `savoo.co.uk`, a voucher-aggregator site that matched live), and a visible SerpAPI
quota-remaining display in the header.

### Reusable gotcha

A real false-positive match (a voucher-aggregator site) was caught live and denylisted — worth
checking any future competitor-search feature for the same class of non-competitor false match
before trusting search results blindly.

### Originating task

`closure/dm-dashboard/2026-09-11_content-gap-analysis-and-product-ownership-cutover.md`

---

## Capability — Product Ownership: Full Rollout Completed (all 6 staff)

### Capability

Completing the 2026-09-09 pilot: all 6 staff now live from the database-backed Product Ownership
source, auto-refreshing, with a bulk-transfer-by-person UI (checkboxes + Select All) and a
`/add` endpoint tagging `used_in` for migration tracking.

### Originating task

Same closure doc as above.

### Related

`2026-09-09_capability.md` (the pilot this completes).
