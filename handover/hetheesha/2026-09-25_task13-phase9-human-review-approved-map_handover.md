# Handover — Task 13 Phase 9: Human Review + Approved Keyword Map

**Owner / reviewer:** Hetheesha (owner) — human review pending
**Date:** 2026-09-25
**Status / closure:** Phase 9 Human Review & Approved Keyword Map Completed —
Final Validation Pending. Local/development implementation only — deployment
pending. Task 13 is NOT closed; Phase 10 remains.

## What was implemented

A review workflow on the existing Task 13 page: the Approved Map tab now has
Pending Review and Approved sub-tabs. A reviewer opens a candidate mapping,
checks the evidence, edits the keywords or target URL if needed, and approves,
rejects or sends it back for edits. Only approved decisions appear in the
Approved keyword map. Approval records the decision only; it never changes
Shopify or any SEO field.

## Where

- Backend: `backend/app/dev_tasks/french_keyword_research/review.py`,
  `authorization.py`, `router.py`, `schema.py`; `backend/app/auth.py`
  (`verify_token`).
- Frontend: `frontend/src/admin/pages/dev-tasks/FrenchKeywordResearch.jsx`
  and `.css` (same page, same Development Tasks entry, no new navigation).
- Uncommitted in dm-dashboard. **Do not push while the Sync Monitor job is
  running** (a push restarts the server and kills the run).

## Data and rules

- Tables: `french_keyword_research_review_state` (one row per reviewed
  candidate, keyed by the normalized candidate primary keyword) and
  `french_keyword_research_review_history` (append-only). Keyed by keyword,
  not by run, so decisions survive the weekly pipeline re-runs.
- Approval status is separate from Mapping Status.
- One primary keyword -> one approved URL, enforced in code and by a partial
  unique index.
- Optimistic concurrency via a `version` token; a candidate fingerprint flags
  when the pipeline later suggests something different.

## Authorization / UAM

Bearer JWT identity, authorized as admin/dev or a holder of the
`tools.DevFrenchKeywordResearch` grant (the existing UAM). Enforced on every
POST/PATCH of the Task 13 router. **Hetheesha still needs to be ticked in the
UAM matrix by an admin** (no grant was written). One grant per task means all
authorized users can review and approve.

## Endpoints (`/api/dev/french-keyword-research`)

`GET /review/queue`, `GET /review/item?key=`, `GET /review/history`,
`GET /approved-map`; `POST /review/edit`, `/review/approve`,
`/review/reject`, `/review/needs-edit`.

## Known limitations

- Testing was cut short; see the Phase 9 validation record for what was and was
  not verified. The UI was not viewed in a browser.
- No blog pages in the inventory until the French Shopify token gets
  `read_content`.
- The map's "demand" data is the Search Console snapshot at approval time; no
  search volume, competition or CPC exists or is shown.

## Phase 10 next step

Test every approve / reject / needs-edit / edit path, authorization for
authorized and unauthorized callers, conflict handling, and the Approved Map in
a browser; verify the UAM grant for Hetheesha; run the full regression; then
close Task 13 only if all criteria pass. Also decide whether to remove the
unused Keyword Planner code from the Task 13 package.
