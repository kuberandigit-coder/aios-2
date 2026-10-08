# Capabilities — 2026-09-09

## Capability — Product Ownership: Database-Backed Migration from Hardcoded Lists

**Date:** 2026-09-09
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Live, Mahima piloted first, completed for all 6 staff by 2026-09-11

### Capability

A new Dev Tool replacing hardcoded per-staff product-ID lists (scattered across multiple files)
with a single database-backed source of truth — migrated **one staff member at a time as a
verified pilot** (Mahima first) rather than cutting everyone over at once.

### Related, same day

- Access control tightened: the "dev" role reserved for Kuberan only, no longer assignable via the
  Users page.
- SKU Audit (new Admin-only page): a real vs. live-ledsone.co.uk spec-sheet comparison, later
  upgraded from parallelized-live calls to a proper background `ScheduledSnapshot` after a slow-load
  issue was found.

### Originating task

`closure/dm-dashboard/2026-09-09_product-ownership-sku-audit-dm-campaign.md`

### Reuse

The "migrate one verified pilot first, then roll out staff-by-staff" pattern — completed for all 6
staff by 2026-09-11 (see that day's capability note) — is reusable for any future hardcoded-list-
to-database migration on this project.
