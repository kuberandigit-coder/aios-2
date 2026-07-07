# Handover — Kamsi Requirement 5: Missing Meta Title & Meta Description Detection

**Title:** Continuation notes for Kamsi Req 5
**Purpose:** Enable a future session to pick this up without re-deriving context
**Requirement Source:** Kamsi Google Sheet sample / screenshot provided by Kuberan
**Business Question:** What's the state of Kamsi's Requirement 5 deliverable and what's left?
**PostgreSQL Sources Checked:** Not used as final source — Shopify only
**External Sources Checked:** None (GA4/GSC excluded)

## What's done
- Confirmed Shopify connector points at `ledsone.co.uk`.
- Pulled all 5,179 products via Bulk Operations API (two passes — second pass added `tags` for the Collection Type fallback): title, description, SEO title/description, product type, collections, tags, updated-at.
- Built detection logic exactly per the approved rule: normalize (strip HTML, collapse whitespace, lowercase for comparison), 3-state (blank/auto/ok) per field, Action Needed as an ordered priority chain.
- Built `kamsi-req5-missing-meta-detection.html` (+ archival copy) with all required KPI cards, filters, sortable table, CSV export, badges, evidence note, mobile-responsive layout — same paginated/in-memory-filter architecture already proven fast on Dilaksi Req2/Kamsi Req4.
- Added Requirement 5 tab link to Kamsi's existing Req 1–4 pages.
- All 6 AIOS docs written.

## What's NOT done
- **Not deployed to Vercel** — no approval requested for this task.
- Archival snapshot copies in `reports/Kamsi/kamsi-requirement-{1,2,3}-*.html` (older static copies, not the live navigable site) were not updated with the Req 5 tab link — out of scope, low priority.

## Decisions worth knowing
- **Tie-break rule for Action Needed:** the task's priority list doesn't explicitly cover mixed states (e.g. title auto-generated + description blank in the same row). Implemented as an ordered if/elif chain — any blank field is caught before any auto-generated field is checked, so blank always wins the label. Flag to Kuberan if a different priority is wanted (e.g., a combined "Rewrite Meta Title and Meta Description" label for the both-auto case, which the task didn't define).
- **Collection Type source:** `product_type` populated for 4,935/5,179 products, so the fallback chain (collection → tag → "Not Available") is rarely exercised in practice — this is expected given the catalog, not a bug.
- Re-running the pipeline: if Shopify SEO fields change and the report needs refreshing, re-run in order: `2026-07-07_kamsi_req5_parse_and_detect.py` (requires a fresh bulk JSONL export — the query is documented in the evidence file) then `2026-07-07_kamsi_req5_html_builder.py`.

## Next step for whoever picks this up
Get Kuberan's review on the tie-break rule above, then deployment approval if the page should go live — same deploy + verify pattern used for every other Dilaksi/Kamsi page in this project (see `vercel/Kamsi/2026-07-07_kamsi_req5_missing_meta_vercel_notes.md`).
