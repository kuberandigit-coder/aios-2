# Capabilities — 2026-08-31

The day the EOD/Admin Panel conversion (kicked off 2026-08-29) actually began, plus a new
AI-assistant feature family.

---

## Capability — Gemini AI Assistant: Grounded Task Suggestions + Conversational Chat

**Owner:** Kuberan, piloted on Jefri's dashboard
**Status:** Live-verified with real Gemini calls and real dashboard data

### Capability

An on-demand "AI Assistant" that gathers a real summary of a dashboard's own live data (Jefri's
Req1-8 numbers + sync health) and sends it to Gemini for two distinct, grounded outputs:

1. **Task suggestions persisted as a real, trackable Postgres list** (mark done/dismissed) — not a
   one-off chat reply that disappears.
2. **A floating conversational chat widget**, pinned bottom-right and visible across every tab,
   answering follow-up questions using the same cached data source as the task suggestions (for
   fast back-and-forth, not a fresh fetch per message) — verified live to correctly answer both an
   initial question and a context-dependent follow-up with real numbers from the actual dashboard.

### Why this is distinct from the existing local-LLM capabilities

This is the first capability found using **Gemini directly for live, data-grounded conversational
assistance**, as opposed to the existing local-LLM patterns
(`2026-09-22_capability.md`'s FAQ schema generation, the anti-repeat pattern) which are
single-shot content-generation calls, not a persistent, conversational, data-grounded assistant.

### Originating tasks

`closure/jefri/2026-08-31_ai-assistant-gemini.md`, `closure/jefri/2026-08-31_ai-chat-widget.md`

### Reuse

Explicitly built "as an example before any wider rollout" — the pattern (gather real summary data
→ Gemini → persist suggestions in Postgres; cache the same data for a conversational follow-up
layer) is intended to extend to other staff dashboards, not stay Jefri-only.

---

## Capability — Verbatim Static-Page Port + Dead-Dependency Repair (no rewrite)

**Owner:** Kuberan, EOD Reports tab
**Status:** Live, build clean

### Capability

When porting an old system's working page into a new app, **port the file verbatim (no rewrite)
when explicitly instructed, and separately diagnose and fix only the broken external
dependencies** — rather than treating "port this page" as a license to rebuild it.

### Technical implementation

- Analyzed the old "EOD Reports" tab's full dependency chain first: an admin session gate pointing
  at a backend that no longer exists, direct unauthenticated client-side GitHub API reads
  (confirmed still working since the repo is public), and one genuine server-side dependency
  (`/api/auth?action=eod-dates`).
- Ported all 4 files verbatim into the new app's static-public folder.
- Fixed exactly 2 things: removed the dead auth gate, and swapped the one real backend call for a
  direct GitHub call using a URL constant that was already present in each file but unused.
- Flagged honestly, not silently accepted: the ported static pages now carry no server-side auth
  check of their own (matching this app's existing trust model, but called out explicitly rather
  than assumed fine).

### Originating task

`closure/eod-tool/2026-08-31_old-eod-reports-tab-analysis-and-port.md`

### Reuse

A reusable migration shape for "port this exact page, don't rebuild it" requests: map every
dependency first, port the file unchanged, then fix only what's actually broken — and say plainly
what trust/security properties did or didn't carry over.

---

## Note — ScheduledSnapshot resilience fix (same day)

Jefri Req1's auto-sync was failing due to the shared database role's hard 10-connection limit (an
external constraint, not fixable in-app). Added automatic retry-with-backoff (5 attempts over ~7
minutes) directly inside `ScheduledSnapshot.run_sync` for this transient failure mode, plus a small
extra slot of connection headroom — making the scheduler self-heal from a connection spike instead
of staying stale for up to 2 days. See `2026-08-29_capability.md` (the `ScheduledSnapshot` origin)
for the base pattern this directly extends — not written up as a separate capability since it's an
in-place improvement to that same shared module, not a new one.
