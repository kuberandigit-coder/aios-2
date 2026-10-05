# Closure — dm-dashboard: Two Production Incidents from Leftover Flat-Structure Imports

**Dates:** 2026-10-02 (incident 1) and 2026-10-05 (incident 2, found by sweeping for the
same bug class)
**Developer:** Kuberan
**Root cause class:** both incidents trace back to the backend restructuring done earlier
this session (reorganizing ~250 flat files in `backend/app/` into `core/`, `staff_pages/`,
`admin/`, `sales/`, `ai_chat/`, `dev_tasks/`) — specifically, local (function-scoped) imports
that were never updated to the new relative paths, because they're invisible to both
`py_compile` and `import app.main`: a local import only fails when the function containing
it actually runs, not at module load time.

## Incident 1 — 2026-10-02: full dashboard outage (502 Bad Gateway)

**Trigger:** a GitHub "Dev Tools" merge (main ↔ dev-work) corrupted `ConduitSold.jsx` and
`admin_conduit_stock.py` (stray literal `main` text replacing real code blocks; a deleted
docstring opening line) while resolving a genuine two-sided conflict. This broke the frontend
build, but the resulting live crash was actually a **second**, separate bug: `main.py` called
`start_conduit_sold_snapshots()` without importing it (the import line itself had been
dropped by the same bad merge, while the call site survived). systemd restarted the crashed
process in an infinite loop — confirmed via `journalctl -u dm-dashboard.service`: "Scheduled
restart job, restart counter is at 70."

**Diagnosis path:** screenshot of a failed Vercel-style build error → confirmed locally that
dev-work's own code built clean → found the literal corruption by diffing against `main` →
fixed and pushed → dashboard still down → walked the user through `ps aux`, `systemctl
list-units`, `journalctl` on the actual server terminal (user had direct SSH access, Claude
did not) → found the real `NameError` in the live crash log → hotfixed directly on the server
(`sed` one-liner + `systemctl restart`) to restore service immediately → committed the
identical fix to git afterward so the repo matches what's actually running.

**Why the earlier `import app.main` check didn't catch it:** that check proves the module
graph resolves, not that every code path inside it is correct — `start_conduit_sold_snapshots()`
is only called from inside a `@app.on_event("startup")` handler, which plain import never
triggers.

## Incident 2 — 2026-10-05: Sync Monitor 500 + 3 more silent failures

**Trigger:** reported by Kuberan — Sync Monitor's "Sales — Auto-Sync Status" page showed
"Failed to load sync status," and a hard refresh didn't fix it.

**Diagnosis path:** confirmed the backend was healthy first (real sync rows writing to
Postgres every few minutes — ruled out a repeat of Incident 1) → asked for the browser
Network tab → saw `/api/sales/sync/status?scope=X` returning 500 for every scope value tried,
while the sibling `/sync/history` endpoint succeeded every time → that 100%,
scope-independent failure rate pointed at shared code, not scope-specific logic → found
`sales.py`'s `sync_status()` doing `from .scheduled_snapshot import REGISTRY`, a path that
resolved to `app.sales.scheduled_snapshot` (doesn't exist) instead of `app.core.scheduled_snapshot`
(where the file actually lives post-restructuring) → fixed, then verified by **actually
calling the function against real data**, not just `py_compile`, since that's the exact class
of check that would have missed this bug the first time.

**Swept the rest of the backend for the same leftover-path pattern and found 3 more, all
live and broken:**
- `ai_chat/ai_shared.py` — `from .db import get_conn` / `get_business_conn` (3 occurrences) —
  used by every AI chat assistant to save/load conversation history.
- `ai_chat/kamsi_ai.py` and `ai_chat/sajeepan_ai.py` — `from .auth import verify_admin_token`.
- `staff_pages/jefri_ai_assistant.py` — `from .scheduled_snapshot import REGISTRY`.

All 4 fixed to `from ..core.X import ...`, matching the already-correct module-level imports
present in the same files (confirming the fix is consistent with the codebase's own established
pattern, not a new convention). Final repo-wide grep confirmed no remaining instances of this
pattern anywhere in `backend/app/`.

## Lesson carried forward

A clean `python -c "import app.main"` or `py_compile` pass is necessary but not sufficient
evidence that a restructuring didn't break anything — local/function-scoped imports need
either an actual functional smoke test per affected endpoint, or a dedicated static check
(e.g. grepping for every `from \.` relative import against the restructured file tree) before
trusting a refactor is complete. The repo-wide grep sweep used in Incident 2 is the cheap
version of that check and should be run as a standard step after any future file-move
refactor in this codebase.

## Evidence / Validation

- Daily logs: [[2026-10-02_daily-work-log]], [[2026-10-05_daily-work-log]]
- No separate evidence/validation doc — both incidents verified by direct, real functional
  tests (server log output, live function calls against real data, final repo-wide grep) as
  described above, captured inline in the commit messages and daily logs rather than
  duplicated here.

## Files changed

- Incident 1: `backend/app/main.py` (restored missing import), `frontend/src/admin/pages/ConduitSold.jsx`,
  `backend/app/admin/admin_conduit_stock.py` (both restored from corruption). Merged to `main`
  directly both times (production-down exception to the dev-work-only push policy, explicit
  instruction each time).
- Incident 2: `backend/app/sales/sales.py`, `backend/app/ai_chat/ai_shared.py`,
  `backend/app/ai_chat/kamsi_ai.py`, `backend/app/ai_chat/sajeepan_ai.py`,
  `backend/app/staff_pages/jefri_ai_assistant.py`. Pushed to `dev-work`; not yet merged to
  `main` as of this closure.

## Status

**Both incidents resolved and verified.** Incident 2's fix is on `dev-work`, awaiting Kuberan's
merge to `main` (or an explicit instruction to push it directly, as was done for Incident 1
given the production-down severity).
