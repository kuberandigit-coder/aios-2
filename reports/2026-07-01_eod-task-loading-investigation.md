# Investigation Report — EOD "No tasks found" (review.html / AppsScript.js)

**Date:** 2026-07-01
**Status:** ROOT CAUSE CONFIRMED — PASS (investigation only, no fix applied per instruction)
**Full evidence:** `evidence/eod/task-loading/2026-07-01_task-loading-investigation.md`

## Requirement
Investigate (read-only, no fix) why the EOD 14-Day Review tool shows "No tasks found" for a member/date combination that demonstrably has data in the Google Sheet.

## Issue description
User selects Team Member = Mahima, Task Date = 01/06/2026, clicks Load Tasks. App shows "No tasks found for Mahima on 01/06/2026. Try a different date."

## Observed behaviour
`review.html` renders the warning alert exactly as coded at `review.html:497-499`, triggered by `tasks.length === 0` after the Apps Script `search` call returns `{ ok:true, tasks:[] }`.

## Expected behaviour
Task IDs T0001-T0004 (per user's Google Sheet screenshot, showing T0001-T0006 across 01/06 and 02/06/2026 for Mahima/ADS) should be returned and rendered as task cards.

## Investigation process
1. Read every file in `EOD/` to establish there are two unrelated subsystems sharing the folder; confirmed only `review.html` + `review-status.html` + `AppsScript.js` are relevant.
2. Traced the full call chain from the "Load Tasks" click through `loadTasks()` → `isoToSheet()` → `callScript()` → Apps Script `doPost` → `handleSearch` → `sheetsForDate` → `sheetData` → row matching → response → UI render.
3. Inspected the `SHEETS` whitelist constant and the `sheetsForDate()` month-targeting/fallback logic line by line.
4. Manually walked `sheetsForDate("01/06/2026")` and `handleSearch` with the exact reported inputs (member="mahima", date="01/06/2026").
5. Checked `EOD/.git` commit history for `AppsScript.js` to confirm when the whitelist logic was introduced and that no later commit extended it to June.

## Evidence
See `evidence/eod/task-loading/2026-07-01_task-loading-investigation.md` — full data-flow trace, column mapping, and code excerpts with line numbers.

## Root cause
`AppsScript.js:14-18` hardcodes a 9-entry `SHEETS` whitelist covering only **March, April, and May 2026** (3 sheets × 3 departments: ADS/SEO/TECH). There is no June 2026 entry.

`sheetsForDate()` (`AppsScript.js:76-88`) filters this whitelist for sheets matching the search date's month/year. For a June date, this filter matches **zero** sheets, and the function's fallback (`AppsScript.js:87`: `return hit.length > 0 ? hit : SHEETS;`) then returns **all 9 March/April/May sheets** instead of failing loudly or finding the correct June sheet(s).

`handleSearch` then scans those March/April/May sheets for rows matching a June date — which can never succeed, because June-dated rows live in a sheet tab this code never opens. The result is an empty `tasks[]` array, which the frontend correctly (and unhelpfully) reports as "No tasks found."

**This is a maintenance gap, not a runtime/logic defect that appeared as a regression** — commit `8737221` introduced the whitelist+fallback pattern when only March-May sheets existed, and no subsequent commit extended the list as new monthly sheets (April was added, then presumably June) were created in the spreadsheet.

## Files involved
- `EOD/AppsScript.js` — `SHEETS` constant (lines 14-18), `sheetsForDate()` (lines 76-88)

## Functions involved
- `sheetsForDate(dateStr)` — the function whose fallback masks the missing month
- `handleSearch(data)` — consumes the (wrong) sheet list and returns empty results
- `toDate(v)` — verified correct, not implicated

## Impact
Any search for a date in a month whose sheet name is not in the `SHEETS` constant returns a false "No tasks found," even though the data exists. This will recur every month going forward unless the whitelist is kept in sync with sheet creation — a structural risk, not a one-time bug.

## Risk
Low technical risk to fix (the whitelist is a static array), but **the fix must not be implemented without confirming the exact June sheet tab name(s) in the live spreadsheet** — see Stop Conditions below.

## Confidence level
**High.** The root cause is fully derivable from the code alone (an array literal missing entries), independently corroborated by: (a) the user's screenshot of June-dated rows in ADS-log column format, (b) git history showing the whitelist was last touched before June sheets would exist, and (c) a manual trace of the exact reported inputs reproducing "no tasks found" through the fallback path.

## Recommended fix (NOT IMPLEMENTED)
1. Confirm the exact name(s) of the June 2026 sheet tab(s) in spreadsheet `1yaH4CbQHE0YFoEoluWVAqfKsbiuEBbsKTiCLIcyoPN8` (likely `"ADS Log - June 2026"`, `"SEO Log - June 2026"`, `"TECH Log - June 2026"` following the existing `"<Dept> Log - <Month> 2026"` pattern — but must be confirmed, not assumed, since "Apr" was abbreviated while "March"/"May" were spelled out in the existing list, so June's naming could go either way).
2. Add the confirmed June entries to the `SHEETS` constant in `AppsScript.js:14-18`.
3. Consider replacing the silent `hit.length > 0 ? hit : SHEETS` fallback (`AppsScript.js:87`) with either: (a) a fail-fast/explicit warning when no sheet matches the requested month, or (b) deriving sheet names programmatically (e.g. `ss.getSheets()` filtered by name pattern) instead of a hardcoded array, so this class of bug can't recur for July onward.
4. Redeploy the Apps Script Web App (Deploy → Manage deployments → Edit → New version) — editing `Code.gs` alone does not update a live web app deployment.

## Files requiring change
- `EOD/AppsScript.js` (the `SHEETS` array, and optionally `sheetsForDate()`)
- Live Google Apps Script project bound to spreadsheet `1yaH4CbQHE0YFoEoluWVAqfKsbiuEBbsKTiCLIcyoPN8` (the file in this repo is a source copy pasted manually per the header comment — it must be manually re-pasted and redeployed, this repo push alone won't fix production)

## Estimated risk of the fix
Low — additive change to a static array. Main risk is deploying a new Apps Script version without re-verifying the existing cache isn't serving a stale empty result for `s_mahima_01/06/2026` (30-min TTL) — recommend a `CacheService` cache clear or waiting out the TTL after deploying.

## Testing required
1. Search Mahima / 01/06/2026 → expect T0001-T0004 (or T0001-T0006 per screenshot) to appear.
2. Search a member/date in March/April/May → confirm no regression.
3. Search a date in a still-missing month (e.g. July, once created) → confirm behavior is either correct or fails clearly (not silently empty) if the whitelist-fallback is also hardened per recommendation 3.

## Dependencies
Requires someone with edit access to the Google Sheet + Apps Script project (not just this repo) to confirm the tab name and redeploy.

## Side effects
None anticipated — purely additive to a lookup table, no data mutation.

## Known limitations of this investigation
- Exact June sheet tab name not independently confirmed (no Sheets API credentials in this session) — see Stop Conditions.
- Did not verify whether `SEO Log - June 2026` / `TECH Log - June 2026` also exist and are similarly missing, or only `ADS Log - June 2026` — the screenshot only evidences the ADS one.

## PASS / FAIL
**PASS** — root cause identified with code-level and historical evidence; no fix implemented, no files modified, no commit/push made, per strict rules.
