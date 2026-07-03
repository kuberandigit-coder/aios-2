# Evidence — EOD "No tasks found" Investigation (review.html / AppsScript.js)

**Date:** 2026-07-01
**Mode:** READ-ONLY analysis — no files modified, no commit, no push
**Status:** ROOT CAUSE CONFIRMED (code-level), PASS
**Workspace:** `C:\Users\PC\OneDrive\Desktop\kuberan web\EOD` (own git repo, remote `digitalmarketing69140951-sys/eod-tool`, per `closure/2026-06-29_review-status-member-cards.md`)

## 1. System architecture

The `EOD/` folder contains **two independent subsystems** that happen to share a folder — this matters because only one of them is involved in the bug:

| Subsystem | Files | Backend | Purpose |
|---|---|---|---|
| A — Daily EOD submission | `index.html`, `admin.html`, `summary.html`, `summary2.html` | GitHub API (`CONFIG.REPO_OWNER`/`REPO_NAME`, `ghHeaders()`) | Staff submit end-of-day text reports, stored as commits/files in a GitHub repo |
| B — 14-Day Review tool | `review.html`, `review-status.html` | Google Apps Script Web App (`AppsScript.js`) backed by a Google Sheet | Reviewer picks a member + date, loads that member's tasks from the sheet, writes review text back to column T |

**The bug is entirely in Subsystem B.** Confirmed by grepping all HTML files for `SCRIPT_URL`/`SS_ID` — only `review.html` and `review-status.html` call the Apps Script backend; `index.html`/`admin.html`/`summary*.html` never reference it.

## 2. Data flow (Subsystem B — traced exactly)

```
review.html
  → user picks Team Member (dropdown, e.g. "Mahima") + Task Date (native <input type=date>, ISO yyyy-mm-dd)
  → clicks "Load Tasks" → loadTasks() [review.html:480]
  → dateIso ("2026-06-01") converted via isoToSheet() [review.html:411] → "01/06/2026" (DD/MM/YYYY)
  → callScript({ action:"search", member:"Mahima", date:"01/06/2026" }) [review.html:494]
      → POST to SCRIPT_URL (Apps Script Web App exec URL) [review.html:404, 451]
  → AppsScript.js doPost(e) [AppsScript.js:23]
      → checks data.secret against SECRET
      → routes to handleSearch(data) [AppsScript.js:27, 113]
  → handleSearch:
      → date = toDate("01/06/2026") → normalizes to "01/06/2026" [AppsScript.js:115, 40]
      → target = sheetsForDate("01/06/2026") [AppsScript.js:127, 76]
      → loops target sheets, reads cached/raw rows via sheetData() [AppsScript.js:93, 131]
      → matches rows where toDate(row[1]) === date AND row[3].trim().lower() === member
      → results = [] (no matches — see root cause)
  → returns { ok:true, tasks:[] }
  → review.html: tasks.length === 0 → showLoad("warn", "No tasks found for Mahima on 01/06/2026...") [review.html:497-499]
```

Every function in this chain was inspected directly in the source files — nothing here is inferred.

## 3. Google Sheet mapping

- **Spreadsheet ID:** `1yaH4CbQHE0YFoEoluWVAqfKsbiuEBbsKTiCLIcyoPN8` (`AppsScript.js:11`)
- **Sheet name whitelist (`SHEETS` constant, `AppsScript.js:14-18`):**
  ```
  "ADS Log - March 2026", "SEO Log - March 2026", "TECH Log - March 2026",
  "ADS Log - Apr 2026",   "SEO Log - Apr 2026",   "TECH Log - Apr 2026",
  "ADS Log - May 2026",   "SEO Log - May 2026",   "TECH Log - May 2026"
  ```
  **There is no "June 2026" entry of any kind (ADS/SEO/TECH) in this list.**
- **Column mapping** (0-indexed, from `handleSearch`/`rowToStrings`/`handleGetDayReview`):
  | Index | Field |
  |---|---|
  | 0 | Task ID |
  | 1 | Date (row[1] — matched against search date) |
  | 3 | Member name (row[3] — matched against search member) |
  | 4 | Department |
  | 8 | Task description |
  | 17 | "Worked on" |
  | 19 (col T) | Review text output |
- **Date handling:** `toDate()` (`AppsScript.js:40-60`) accepts JS `Date` objects, Sheets serial numbers, `YYYY-MM-DD`, and `D/M/YYYY`/`DD/MM/YYYY` text, normalizing everything to `DD/MM/YYYY` string for comparison. This function itself is not date-range-limited and would correctly normalize a June date.
- **Caching:** `CacheService.getScriptCache()`, 1800s (30 min) TTL, keyed by sheet name (raw data) and by `member+date` (search result). Cache is irrelevant to this bug — a cache miss on a never-matched query still returns empty, and a fresh (uncached) run was not blocked by cache since the key `s_mahima_01/06/2026` would not have been populated before.

## 4. Verifying the supplied evidence

User-supplied screenshot (image 4) shows raw sheet rows for rows 182-187: Task IDs `T0001`-`T0006`, dates `01/06/2026` and `02/06/2026`, member `Mahima`, department `ADS`, with the same column layout (Task ID, Date, member code e.g. `DMG002`, Member, Dept, Intent code, Tier, Tier desc, Description...) used by the existing `"ADS Log - <Month> 2026"` sheets. This is visually consistent with an `"ADS Log - June 2026"` (or similarly named) tab.

Tracing the query for exactly this input (`member="mahima"`, `date="01/06/2026"`):
1. `sheetsForDate("01/06/2026")`: `mon=6` → `full="June"`, `abbr="Jun"`.
2. Filters `SHEETS` for any entry containing `"June 2026"` or `"Jun 2026"` — **zero matches**, because no June entry exists in the array at all.
3. Fallback triggers: `return hit.length > 0 ? hit : SHEETS;` → falls back to **all 9 March/April/May sheets**.
4. `handleSearch` then scans only March/April/May sheet data for rows where `toDate(row[1]) === "01/06/2026"`. Since those sheets only contain March/April/May dates, **no row can ever match a June date** — not because of a date-parsing bug, but because the June-dated rows live in a sheet tab that is never opened by this code at all.
5. Result: `results = []` → frontend shows "No tasks found."

This reproduces the observed behavior exactly, using only the code and the user-supplied evidence — no assumption was required to explain *why* the search returns empty.

## 5. Files inspected
- `EOD/review.html` (full read: header comment, `SCRIPT_URL`/`SECRET`, `isoToSheet`, `callScript`, `loadTasks`, `renderTasks`)
- `EOD/AppsScript.js` (full read: all functions — `doPost`, `toDate`, `rowToStrings`, `sheetsForDate`, `sheetData`, `handleSearch`, `handleSubmit`, `handleGetDayReview`, `testSearch`, `removeTechReviewHeaders`, `setupReviewHeaders`, `respond`)
- `EOD/review-status.html`, `EOD/index.html`, `EOD/admin.html`, `EOD/summary.html`, `EOD/summary2.html` (grepped for `SCRIPT_URL`/`SS_ID`/`SHEETS` to establish subsystem boundary — Subsystem A confirmed unrelated)
- `EOD/.git` commit history for `AppsScript.js` (`git log --oneline -- AppsScript.js`)
- Prior AIOS docs: `evidence/old records/2026-06-29_aios-setup.md`, `evidence/old records/2026-06-29_review-html-ui-redesign.md`, `evidence/old records/2026-06-29_review-status-member-cards.md`, `closure/2026-06-29_session-closure.md`

## 6. Git history corroboration
```
4441995 feat: add review-status page — daily member card view (today-14 logic)
bf544c6 fix: review-status uses sheetData cache, drop broken array cache, add 45s timeout
8737221 perf: month targeting (3 sheets not 9) + per-sheet cache — 3x faster search
bd7e464 feat: auto-load on open, 14-day fix, month filter, refresh button, 5min cache
0af87fd fix: replace REST API calls with SpreadsheetApp — fixes 403 Google Sheets API disabled error
3b35c2f fix: switch to UNFORMATTED_VALUE + serial-to-date conversion — resolves date mismatch
7218dd3 fix: normalize date format in search — handle 4/5/2026 vs 04/05/2026 vs time suffix
```
Commit `8737221` ("month targeting — 3 sheets not 9") is where the `SHEETS` whitelist + `sheetsForDate()` fallback logic was introduced, at a time when only March/April/May sheets existed. No later commit added a June entry. This is a **maintenance gap** (the hardcoded month list was never extended as new months' sheets were created), not a regression from a specific code change.

## 7. What was NOT verified (residual unknown)
I do not have Google Sheets API/credentials access in this session, so I could not independently open the live spreadsheet (`1yaH4CbQHE0YFoEoluWVAqfKsbiuEBbsKTiCLIcyoPN8`) to confirm the **exact tab name** used for June 2026 data (e.g. whether it's `"ADS Log - June 2026"`, `"ADS Log - Jun 2026"`, or a different naming pattern entirely). This does not change the root cause — regardless of the exact name, that name is absent from the `SHEETS` constant, so the sheet is never scanned — but the exact string is needed before writing the one-line fix. See Stop Conditions in the investigation report.
