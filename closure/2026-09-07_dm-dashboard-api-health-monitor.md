# Closure — API Health Monitor (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard
**Status:** Done, pushed to `dev-work`

## Request
"we use many apis in the dashboard right, i need a monitor for the every
apis like a graph and detailed mechanic view for each apis... danger or
normal or no issue."

## What was delivered
New Dev nav page (API Health) checking every external API the app
depends on: Shopify (DE/UK/FR), Gemini, Groq, NVIDIA DeepSeek, Local
LLM, GitHub (×2 tokens), Postgres (App + Business). Checked every 15
minutes on a background thread; severity shown as danger/warning/no
issue/not configured. Card per API with status pill, latency sparkline,
which staff pages depend on it, and full check history on click.

## Files
- `backend/app/api_health.py` (new)
- `backend/app/admin.py`, `backend/app/main.py`
- `frontend/src/admin/pages/ApiHealthMonitor.jsx` (new)
- `frontend/src/dev/DevLayout.jsx`

See `evidence/2026-09-07_dm-dashboard-api-health-live-catch.md` for
proof it works against real data.
