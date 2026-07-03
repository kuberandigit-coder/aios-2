# System Architecture Report — EOD Tools (`EOD/`)

**Date:** 2026-07-01
**Owner:** Varmen / Kuberan
**Reviewer:** Pending
**Status:** Documented from read-only investigation (see `reports/2026-07-01_eod-task-loading-investigation.md`)

## Purpose
The `EOD/` folder holds two separate internal tools built as static HTML + a Google Apps Script backend. This doc exists because no architecture-level description of `EOD/` existed prior to this investigation — prior docs (`evidence/old records/2026-06-29_*`) covered individual UI redesign tasks, not the system as a whole.

## Components

### Subsystem A — Daily EOD Submission (GitHub-backed)
- **Files:** `index.html`, `admin.html`, `summary.html`, `summary2.html`
- **Backend:** GitHub REST API directly from the browser (`ghHeaders()`, `CONFIG.REPO_OWNER`/`REPO_NAME`)
- **Purpose:** Staff type an end-of-day report; it's committed/stored via GitHub API. Admin views summaries.
- **Not involved in the current bug.**

### Subsystem B — 14-Day Review Tool (Google Sheets-backed)
- **Files:** `review.html` (reviewer loads a member+date, submits review text), `review-status.html` (auto-loads all members for today−14 days, member status cards)
- **Backend:** `AppsScript.js`, deployed as a Google Apps Script Web App bound to Google Sheet `1yaH4CbQHE0YFoEoluWVAqfKsbiuEBbsKTiCLIcyoPN8`
- **This is where the current bug lives.**

## Folder structure
```
EOD/
├── index.html          (Subsystem A — daily submission)
├── admin.html           (Subsystem A — admin views)
├── summary.html          (Subsystem A — summary view)
├── summary2.html         (Subsystem A — summary view, variant)
├── review.html          (Subsystem B — 14-day review, member+date search)
├── review-status.html   (Subsystem B — daily member-card status view)
├── AppsScript.js        (Subsystem B backend — source copy; live copy lives in the Apps Script editor bound to the Sheet)
└── .git/                (own repo, remote: digitalmarketing69140951-sys/eod-tool)
```

## Dependencies
- Subsystem B depends on a **live Google Apps Script Web App deployment** — `AppsScript.js` in this repo is a manually-maintained *source copy*; per its own header comment, changes must be pasted into the Apps Script editor and redeployed to take effect. Editing this repo file alone changes nothing in production.
- Both `review.html` and `review-status.html` hardcode `SCRIPT_URL` and a shared `SECRET` string (`"dwl-review-2026"`) directly in client-side JS — not a build-time secret, visible to anyone viewing page source.
- Google Sheet `1yaH4CbQHE0YFoEoluWVAqfKsbiuEBbsKTiCLIcyoPN8` must contain sheets named `"<Dept> Log - <Month> 2026"` for `handleSearch`'s whitelist to find them (see known limitation below).

## Data flow (Subsystem B)
See `evidence/eod/task-loading/2026-07-01_task-loading-investigation.md` §2 for the fully traced, function-by-function flow from "Load Tasks" click to rendered task cards.

## Known limitation (structural, not a one-off bug)
`AppsScript.js`'s `SHEETS` constant is a **hardcoded array** of sheet names that must be manually extended every time a new month's log sheets are created in the spreadsheet. As of this doc, it only lists March/April/May 2026. This is the direct cause of the "No tasks found" bug for June dates (see investigation report) and will recur for July onward unless either the array is kept current or the lookup is made dynamic (e.g. `ss.getSheets()` filtered by name pattern instead of a static whitelist).

## Status
Documented — not yet reviewed by a human owner.
