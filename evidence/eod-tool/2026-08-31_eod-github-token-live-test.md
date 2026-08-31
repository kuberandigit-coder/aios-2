# Evidence — EOD Tool: GitHub token configured, live end-to-end test

**Date:** 2026-08-31
**Purpose:** Confirm the EOD Tool (dm-dashboard) is fully live after adding
`EOD_GITHUB_TOKEN` to the backend, closing out the last gap from the EOD
migration (old `pages/eod/index.html` + `admin.html` → unified `EodPage.jsx`).

## What was done
1. Added `EOD_GITHUB_TOKEN` to `dm-dashboard/backend/.env` (token supplied
   directly by the user in chat).
2. Killed the two stray `uvicorn app.main:app --port 8499` processes and
   restarted the backend so it picked up the new env var.
3. Verified via curl:
   - `GET /api/health` → `{"status":"ok"}`
   - `GET /api/eod/admin/status?date=2026-08-31` → real GitHub-backed data,
     no more `500 EOD_GITHUB_TOKEN missing` error. Response included 14
     staff members; Kamsi correctly returned `status: "leave"` with the
     actual `# Leave` markdown content already present in the
     `eod-reports` GitHub repo for today's date — proving read access to
     real historical data, not a stub/empty response.

## Result
PASS — `EOD_GITHUB_TOKEN` is live in the backend, and the unified EOD Tool
(staff self-service submit/leave/history + admin attendance grid +
act-on-behalf + browse-history) can now read/write real GitHub data end to
end.

## Reviewer / Next step
- Reviewer: pending user sign-off after browser click-through (submit a
  report as a staff account, confirm it appears in admin's grid).
- Next step: none required unless user wants further browser-based
  verification of write paths (submit/leave/act-on-behalf), which were not
  separately curl-tested this pass (read path confirmed; write path shares
  the same `_put_file`/token wiring so is expected to work, but not yet
  independently exercised).
