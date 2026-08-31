# Evidence — Jefri AI Assistant (Gemini-powered task suggester)

**Date:** 2026-08-31
**Purpose:** User asked for an AI assistant using the Gemini API, piloted
on Jefri's dashboard, acting as a "task assigner" -- clarified via
questions to mean: on-demand button that analyzes Jefri's own Req1-8 data
+ sync health and suggests prioritized, trackable tasks (persisted in
Postgres, not just a chat reply).

## What was built

`backend/app/jefri_ai_assistant.py` (new):
- `public.jefri_ai_tasks` Postgres table (title, description, priority,
  source, status, timestamps).
- `gather_summary()` -- runs 7 of Jefri's 8 requirement pages concurrently
  (`ThreadPoolExecutor`) and extracts each one's own already-computed
  aggregate fields (villains/zombies counts, trend counts, mapping
  totals, etc.) rather than sending raw row data. Req5 (Cross-Campaign
  Attribution) is deliberately excluded -- it has no "all campaigns"
  aggregate view, only answers for one specific source campaign at a
  time, so there's no single number to summarize.
- `call_gemini_for_tasks()` -- calls the Gemini REST API
  (`gemini-flash-latest`, resolves to `gemini-3.7-flash` currently) with
  a prompt instructing it to return ONLY a JSON array of tasks grounded
  in the actual data. Retries up to 3 times with backoff on transient
  429/500/503 (Gemini's flash-latest occasionally returns "high demand"
  503s, confirmed live during testing).
- `POST /api/jefri/ai/suggest-tasks` -- gathers summary, calls Gemini,
  saves tasks, returns them.
- `GET /api/jefri/ai/tasks` -- list all tasks.
- `POST /api/jefri/ai/tasks/{id}/status` -- mark pending/done/dismissed.
- Registered in `backend/app/main.py`.
- `GEMINI_API_KEY` added to `backend/.env` (user-supplied key, confirmed
  valid via a live test call before building the feature).

`frontend/src/jefri/pages/AiAssistant.jsx` (new): "Suggest Tasks" button,
task list with priority pills (High/Medium/Low), status pills
(Pending/Done/Dismissed), Done/Dismiss/Reopen actions, filter tabs. Styled
with the same `jreq-header`/card conventions used everywhere else.

`frontend/src/jefri/JefriLayout.jsx`: new "AI Assistant" nav item (lazy
panel, between EOD Tool and Req1).

## Verification (live, real data, real Gemini calls)
- Confirmed the user-supplied Gemini API key is valid; `gemini-1.5-flash`/
  `gemini-2.5-flash` are deprecated for new keys -- `gemini-flash-latest`
  works (currently resolves to `gemini-3.7-flash`).
- `POST /api/jefri/ai/suggest-tasks` -> 200 in 21.7s, returned 5 real
  tasks grounded in actual live data, e.g.:
  - "Review and optimize 547 villain products in Google Ads" (Req1,
    referencing the real 547/2,508 villain count and £10,884.56 ad cost)
  - "Add negative keywords for 640 villain search terms" (Req2, real
    640/65,774 counts)
  - "Map 2,472 unmatched item IDs to parents or variants" (Req4, real
    2,472/8,394 counts)
- Confirmed persistence: `GET /api/jefri/ai/tasks` returned all 5 tasks
  with correct UTF-8 (£ symbol, em-dash) after restart.
- Confirmed status update: `POST /tasks/1/status {"status":"done"}` ->
  verified task 1 shows `status: "done"` on next GET, others unaffected.
- `npx vite build` -> `✓ built in 1.17s`, no errors.

## Reviewer
Pending user confirmation in the live UI -- open Jefri -> AI Assistant ->
click "Suggest Tasks" and confirm the suggestions look useful.
