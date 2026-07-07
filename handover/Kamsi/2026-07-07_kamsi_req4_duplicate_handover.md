# Handover — Kamsi Requirement 4: Duplicate of Dilaksi Requirement 2

**Title:** Continuation notes for Kamsi Req 4
**Purpose:** Enable a future session to pick this up without re-deriving context
**Requirement Source:** GPT planning layer instruction, 2026-07-07
**Business Question:** What's the state of Kamsi's Requirement 4 deliverable and what's left?
**PostgreSQL Sources Checked:** Not checked for this task because copy-only reuse was requested
**External Sources Checked:** Not checked for this task because copy-only reuse was requested

## What's done
- Found Dilaksi Requirement 2 source (`dilaksi-req2-all-products.html`, the paginated all-collections build).
- Created `kamsi-req4-product-priority-guidance.html` as an exact duplicate — only 6 label/nav strings changed (title, tab-nav, eyebrow, "Requested by", rule-note attribution, footer note). CSS/JS/data confirmed byte-identical to source via automated diff.
- Archival copy saved to `reports/Kamsi/kamsi-requirement-4-product-priority-guidance.html`, matching the existing `kamsi-requirement-{1,2,3}-*.html` naming pattern.
- Added a Requirement 4 tab link to Kamsi's existing R1/R2/R3 pages (`kamsi-req1-slow-moving-products.html`, `kamsi-req2-low-ctr-pages.html`, `kamsi-req3-core-ga4-seo.html`) so navigation is consistent across all four.
- The duplication script is saved and re-runnable: `reports/Kamsi/data/2026-07-07_kamsi_req4_duplicate_from_dilaksi_req2.py` — if Dilaksi Req 2 is updated again later and Kamsi's copy needs to follow, re-run this script (it asserts each expected string exists, so it will fail loudly rather than silently apply stale replacements).

## What's NOT done
- **Not deployed to Vercel** — no approval was requested for this task; deployment was explicitly out of scope per the task rules.
- `kamsi.html` (the old member-index stub, which already only listed R1/R2 and was stale before this task) was **not** touched — fixing it was out of scope.

## Decision worth knowing
The task instructions suggested the tab label "Kamsi Requirement 4 — Core GA4 Data for SEO" as an example — but that's literally Kamsi's existing Requirement 3 title. Reusing it for Req 4 would create a duplicate/confusing label. Used **"Kamsi Requirement 4 — Product Priority Guidance"** instead (matching what the underlying Dilaksi Req 2 content actually is). Flagged this to Kuberan in the evidence file rather than silently picking one — revisit if a different label is preferred.

## Known limits to carry forward
- The dataset shown on Kamsi's Req 4 page is literally Dilaksi's ledsone.co.uk full-catalog data (5,179 products, all 475 collections) — this was intentional per the "copy exactly, no new data" instruction, not an error.
- If Kamsi later needs her *own* product-priority data (a different store/dataset), that would be a new requirement, not an extension of this duplicate.

## Next step for whoever picks this up
Get Kuberan's review on the label decision above, then deployment approval if the page should go live on Vercel — follow the same deploy + verify pattern used for Dilaksi Req 2 (see `vercel/Kamsi/2026-07-07_kamsi_req4_duplicate_vercel_notes.md`).
