# Handover — Sales 2026 UK: Shopify Actuals tab fixed end-to-end

Date: 2026-09-22
Owner: Piranav (original feature), fixes by dm-dashboard dev tooling
Reviewer: project owner/team

## What was fixed

The new Shopify Actuals tab on the UK Sales 2026 page was stuck showing
"No data" — traced through 5 distinct, compounding bugs (frontend never
polled a slow backend job; a stale pre-rewrite cache; a hard-timeout fix
that itself deadlocked on `shutdown(wait=True)`; a missing
`read_reports` Shopify scope; and a wrong ShopifyQL column name,
`sales_reversals` instead of `returns`). Full root-cause chain and live
evidence in the evidence.md companion file.

## Files changed

- `frontend/src/admin/pages/Sales2026.jsx` (polling fix)
- `backend/app/sales.py` (hard-timeout wrapper + fix to that wrapper +
  column name fix)

## Access change (not code)

User obtained and granted the `read_reports` Google/Shopify Merchant
Center scope — this was the actual root blocker; no code fix could work
around a genuinely missing permission.

## Testing

Live-verified directly against the real production API repeatedly
throughout this fix chain (not just local testing) — including polling
the live endpoint for 5+ minutes to distinguish "still computing" from a
genuine stuck thread, and a final confirmation showing 9 months of real
2026 GBP sales data returned in 1.2s.

## Current status

Fully fixed and confirmed live in production. Commits `6ce8b8e`,
`f08b1c5`, `477a977`.

## Known limitations

None remaining for this specific tab.

## Next step

None — done. (Unrelated note: this investigation is also what surfaced
the user's later instruction to keep all dm-dashboard pushes on
`dev-work` only going forward, rather than pushing urgent fixes directly
to `main` as had been done for this one.)
