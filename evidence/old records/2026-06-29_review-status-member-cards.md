---
title: 2026-06-29 Evidence — Review Status Member Card Page
date: 2026-06-29
task: review-status page rebuild — today−14 logic, member cards
status: COMPLETE
---

## What was built

New `EOD/review-status.html` with:
- Auto-loads on open — no button needed
- Shows tasks from exactly TODAY − 14 days (e.g. 29/06 → shows 15/06 tasks)
- ← / → date navigation to go back or forward one day at a time
- "Today" button resets to current today−14

## Member Cards Layout

Each member who had tasks on that date gets a card:
- Green card + "All Reviewed" pill — every task submitted
- Red card + "Not Submitted" pill — zero reviews
- Amber card + "X/Y Done" pill — partial

Inside each card: task list with dot indicator (green=done, red=missing), task ID, description, and review text.

## Summary Stats (top)

| Stat | Description |
|------|-------------|
| Members | Total who had tasks |
| All Reviewed | Count fully done |
| Missing | Count with zero reviews |
| Partial | Count partially done |

## Apps Script Change

Replaced `handleReviewStatus` (full dump) with `handleGetDayReview`:
- Takes `date: DD/MM/YYYY`
- Reads only ADS + SEO sheets (TECH excluded from 14-day review)
- Returns `members[]` grouped by member name, each with `tasks[]`
- Reuses `sheetData()` cache — fast if handleSearch already populated it

## Files Changed

| File | Change |
|------|--------|
| `EOD/review-status.html` | Created — new page |
| `EOD/AppsScript.js` | Replaced `handleReviewStatus` with `handleGetDayReview` |
| `EOD/admin.html` | Re-added `📋 Review Status` sidebar link |

## Git Commit

`4441995` — pushed to `digitalmarketing69140951-sys/eod-tool` main
