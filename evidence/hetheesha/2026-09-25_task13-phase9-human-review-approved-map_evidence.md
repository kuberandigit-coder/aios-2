# Evidence — Task 13 Phase 9: Human Review + Approved Keyword Map

**Date:** 2026-09-25
**Status:** Phase 9 Human Review & Approved Keyword Map Completed — Final
Validation Pending. Local/development implementation only — deployment
pending. End-to-end testing was cut short by the user's instruction (see the
validation record for exactly what was and was not verified).

## What was built

A controlled review workflow that turns the pipeline's candidate
"primary keyword -> URL" mappings into an approved keyword map.

- **Approval statuses** (separate from the pipeline's Mapping Status):
  `PENDING_REVIEW` (default, no saved row), `NEEDS_EDIT`, `APPROVED`,
  `REJECTED`. Allowed moves: pending -> approved / rejected / needs-edit;
  needs-edit -> approved / rejected; approved -> needs-edit / rejected
  (revoke); rejected -> reopened by an edit. An approved mapping is locked
  until it is revoked.
- **Approve** (server-side): authenticated + authorized caller; primary
  keyword must exist in the research dataset and (if changed) belong to the
  cluster; target URL must exist in the verified ledsone.fr Shopify page
  inventory, be a supported page type compatible with the intent, and (for a
  product) be ACTIVE; no other approved mapping may use the same normalized
  primary keyword. Records reviewer, timestamp, notes and an evidence
  snapshot (mapping reason/status, Search Console demand at approval time).
- **Reject** requires a reason (a note as well for "Other"); **Needs Edit**
  requires a note. A reviewer can always reject or send back even if the
  candidate page went stale.
- **Approved keyword map** returns only `APPROVED` entries and is the clean
  contract for downstream SEO tasks (`contract_version: 1`). Nothing here
  changes Shopify, titles, meta, canonicals, redirects or content.

## Design decision: persistent tables keyed by keyword

Mapping rows and cluster ids are created per pipeline run (the weekly Sync
Monitor job creates new ones each time), so a decision stored on them would be
orphaned at the next run. Decisions therefore live in two new tables keyed by
the **normalized candidate primary keyword**:

- `french_keyword_research_review_state` — one row per reviewed candidate,
  optimistic-concurrency `version`, candidate fingerprint (detects when the
  pipeline later suggests something different), evidence snapshot. A
  partial unique index (`primary_key` where status = APPROVED) makes "one
  primary keyword -> one approved URL" a database guarantee as well as a code
  check.
- `french_keyword_research_review_history` — append-only audit trail (action,
  old/new status, original vs edited keyword and URL, reason, note, reviewer,
  timestamp, state version).

The review queue is the latest mapping run LEFT JOINed with the saved state, so
re-runs never overwrite a decision; a keyword that is no longer produced keeps
its decision; a changed candidate is flagged. Additive schema only (no existing
table or constraint altered, so the running pipeline job is unaffected).

## Server-side authorization

Identity comes from the same Bearer JWT the login issues (`sub`, `role`,
`staff_key`), decoded by a new `auth.verify_token`. Authorization reuses the
existing User Access Management model: role `admin`/`dev`, or a row in
`access_grants` for task key `tools.DevFrenchKeywordResearch` and the caller's
staff key (the grant an admin ticks in the UAM matrix; revoking deletes the
row). The existing UAM has one grant per task, so every authorized user may
review and approve — no new permission type, no per-user hardcoding. The
reviewer name and time are taken from the token on the server, never from the
request body. Enforced on every POST/PATCH in the Task 13 router (the existing
build/run/classify/cluster/mapping/gap POSTs were protected too, and the old
mapping PATCH can no longer set APPROVED). Read-only GETs stay open, matching
the existing dev-task convention. **No access-grant rows were written**; an
admin must still tick Hetheesha in the UAM matrix.

## Endpoints (`/api/dev/french-keyword-research`)

Reads: `GET /review/queue`, `GET /review/item?key=`, `GET /review/history`,
`GET /approved-map`. Writes (authorized): `POST /review/edit`,
`/review/approve`, `/review/reject`, `/review/needs-edit`.

## Frontend

`FrenchKeywordResearch.jsx` — the Approved Map tab now has **Pending Review**
and **Approved** sub-tabs: status cards, a filterable/paginated review queue,
and a review drawer (keyword and URL information, mapping evidence, Search
Console evidence, alternative URLs, gap and potential-cannibalisation records,
editable primary/secondary keywords, target URL and notes, history) with
Approve / Reject / Needs Edit / Save edits, a confirmation dialog for approve,
reject and significant changes, and server errors shown inline (with a
"Reload this item" action on conflicts). Auth is sent as the `dm_token` Bearer
header like other authenticated calls. The Overview "approved" count now comes
from the approved map. No Keyword Planner, volume, competition or CPC is used
anywhere in the new code.

## Files

Backend: `dev_tasks/french_keyword_research/review.py` (new),
`authorization.py` (new), `router.py`, `schema.py`; `backend/app/auth.py`
(`verify_token`). Frontend: `FrenchKeywordResearch.jsx`, `.css`.
Uncommitted in dm-dashboard; not deployed.

## Cleanup performed

The earlier partial API testing left 3 rows in `review_state` and 8 in
`review_history` (reviewer `zz-test-reviewer`, notes `zz-test ...`, including
one test APPROVED row). All were deleted; both tables are now empty (0 rows)
and `url_mappings` was not modified.
