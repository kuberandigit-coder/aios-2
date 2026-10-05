# Daily Work Log — 2026-10-05

- **dm-dashboard — styled the Users page's editable role dropdown.** The `<select>` shown
  while editing a user's row was unstyled browser default, out of place next to the colored
  "admin"/"staff" pill badge shown everywhere else in that table. Added `.admin-role-select`
  (same shape, color, weight as the existing badge, plus a custom dropdown arrow). Pushed to
  `dev-work`.

- **dm-dashboard — diagnosed and fixed a real, consistent 500 error on Sync Monitor's
  "Sales — Auto-Sync Status" page ("Failed to load sync status"), plus 3 more instances of
  the same bug class found by sweeping the rest of the backend.** Reported by Kuberan with a
  screenshot; a hard page refresh didn't fix it, which ruled out a stale-cache/token
  explanation. Confirmed first that the backend itself was healthy (real sync rows writing to
  Postgres every few minutes, no errors) — this was not a repeat of the 2026-10-02 outage.
  Asked for the browser's Network tab, which showed `/api/sales/sync/status?scope=X`
  returning HTTP 500 for every single scope value tried (sales, and every dev-task scope),
  while the sibling `/api/sales/sync/history` endpoint succeeded every time. That 100%,
  scope-independent failure rate pointed at code shared by every call path rather than
  scope-specific logic.
  Root cause: `sales.py`'s `sync_status()` did `from .scheduled_snapshot import REGISTRY` —
  a relative import left over from before the backend restructuring, when `scheduled_snapshot.py`
  lived flat in `app/`. It now lives in `app/core/`, so this import resolved to a module that
  doesn't exist and raised `ModuleNotFoundError` on every call. `py_compile` and
  `import app.main` never caught it because it's a local (function-scoped) import — it only
  fails when the function actually runs, not at module load time.
  Swept the whole backend for the same leftover-path pattern and found 3 more live, broken
  instances: `ai_chat/ai_shared.py` (`from .db import get_conn` / `get_business_conn`, used
  by every AI chat assistant to save/load conversation history), `ai_chat/kamsi_ai.py` and
  `ai_chat/sajeepan_ai.py` (`from .auth import verify_admin_token`), and
  `staff_pages/jefri_ai_assistant.py` (`from .scheduled_snapshot import REGISTRY`). All 4
  files fixed (`from ..core.X import ...`, matching the already-correct module-level imports
  in the same files), verified by actually calling the fixed function against real data (not
  just checking it compiles), and confirmed via a final repo-wide grep that no instances of
  this pattern remain anywhere. Pushed to `dev-work`. See
  [[2026-10-05_production-incidents-broken-imports_closure]].
