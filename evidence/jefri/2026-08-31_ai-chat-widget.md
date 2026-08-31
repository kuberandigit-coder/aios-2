# Evidence — Jefri AI chat + floating chatbot widget

**Date:** 2026-08-31
**Purpose:** User asked for Jefri to also have chat, and a chatbot widget
added to the system. Clarified via questions: floating widget on Jefri's
dashboard only (pilot), conversational, grounded in his own Req1-8 data
(same source as the earlier "Suggest Tasks" feature).

## What was built

`backend/app/jefri_ai_assistant.py` (extended):
- `public.jefri_ai_chat_messages` table (role, content, created_at) --
  conversation persists across page reloads.
- `get_cached_summary(force=False)` -- in-memory cache (5 min TTL) of the
  Req1-8 summary. `gather_summary()` takes ~10-20s (live Shopify/Postgres
  calls for Req2-4/7), which is fine for one deliberate "Suggest Tasks"
  click but far too slow to re-run on every chat message. Chat reuses the
  cache; `suggest-tasks` always forces a fresh gather and refreshes the
  cache so chat picks up new data too.
- `_call_gemini_text()` -- extracted the retry-with-backoff Gemini call
  (429/500/503) into a shared low-level helper reused by both task
  suggestion and chat, instead of duplicating the retry logic.
- `call_gemini_chat(history, summary)` -- builds a multi-turn Gemini
  `contents` array (system-style data-grounding message + up to the last
  20 stored messages), translating this app's `assistant` role to
  Gemini's own `model` role name.
- `GET /chat/messages`, `POST /chat` (send + get reply), `POST /chat/clear`.

`frontend/src/jefri/pages/AiChatWidget.jsx` (new): floating bubble pinned
bottom-right, expands into a chat panel (message history, input, send,
clear). Mounted once in `JefriLayout.jsx` as a sibling to `DashboardShell`
(not inside a tab panel) so it stays visible across every one of Jefri's
tabs, not just the AI Assistant page.

## Verification (live, real Gemini calls, real data)
- `POST /api/jefri/ai/chat {"message":"How many villain products do I have right now?"}`
  -> 200 in 26.3s (first call, cold cache): *"You currently have **547**
  villain products out of your 2,508 total tracked products."* -- matches
  the real Req1 data exactly.
- Follow-up `POST /chat {"message":"What about zombies? and whats the total ad cost?"}`
  -> 200 in 24.5s: *"Zombies: **0**... Total Ad Cost: **£10,884.56**
  (conversion value £29,977.68)"* -- also matches real data, and
  correctly answered a follow-up question using conversation history
  (understood "zombies" and "ad cost" referred to the same Req1 context
  from the first message).
- Confirmed response times vary 20-30s (the model does internal
  "thinking" on every call, observed in raw API responses) -- normal
  `fetch()` has no default timeout, so this is fine for the UI as long as
  a "Thinking…" indicator is shown, which the widget has.
- `npx vite build` -> `✓ built in 1.52s`, no errors.
- Test conversation cleared via `/chat/clear` before handoff so Jefri
  starts with an empty widget.

## Reviewer
Pending user confirmation in the live UI -- open Jefri's dashboard, the
chat bubble should be visible bottom-right on every tab.
