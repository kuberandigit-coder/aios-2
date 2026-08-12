# Evidence — muguntha.html Performance Tab: Speed Optimization Attempted and Reverted (2026-08-12)

**Purpose:** Record of a failed optimization attempt, kept for reference so the same approaches aren't retried unknowingly.

## Problem
Sonya's Performance tab (and by extension the other built members) loads very slowly — the `loadAll()` function fires ~40 sequential per-month HTTP requests (2025 sales, 2026 sales, 2025 cost, 2026 cost × up to 20 months), originally capped at concurrency 5.

## Attempt 1 — raise client concurrency 5→20 (`2c27985`)
Reasoning: closed months are served from static snapshot files, which should be cheap. In production this caused a real Postgres error: `"sorry, too many clients already"`. Root cause: `sales25.js`, `salesuk.js`, and `muguntha.js` **all open their own Postgres connection pool**, even on the snapshot fast path (used for override lookups etc.) — 20 concurrent serverless invocations across 4 parallel `mapLimit` calls exhausted the database's connection limit. **Reverted same day** (`c05d350`).

## Attempt 2 — batched in-process endpoint (`9260168`, later deleted)
Built `api/muguntha-perf-sonya.js`: instead of the browser making 40 HTTP requests, one new endpoint called the same three handler modules (`salesuk.js`, `sales25.js`, `muguntha.js`) in-process via a synthetic req/res pair, avoiding network round-trips entirely. In production, this **hung indefinitely** — a direct `curl` test timed out after 30 seconds with no response (`HTTP:000`). The exact cause was not fully diagnosed (candidates: Vercel serverless function time limit being hit silently, or the in-process approach still triggering the same Postgres connection-pool exhaustion as Attempt 1, just harder to observe). **Reverted same day** (`134e14a`, then fully removed via `d911f63` per explicit instruction: "undo all that is not useful... we will do later").

## Outcome
Both approaches failed and were fully reverted via `git checkout` to the pre-optimization commit (`bce5bc2`). `muguntha.html`'s Performance tab is back to its original, known-working behaviour — same speed as before this date, no regression, but the original slowness complaint is **still unresolved**.

## Files touched (net: reverted to no change)
- `reports/digital-marketing-member-pages/pages/muguntha.html`
- `reports/digital-marketing-member-pages/api/muguntha-perf-sonya.js` (created, then deleted same day)

## Deployment
Final state (post-revert) deployed and confirmed matching pre-optimization behaviour.

**Status:** FAILED / REVERTED — not a working fix, documented as a lesson for future attempts
**Reviewer:** Muguntha (pending review)
**Next step:** A real fix needs either (a) a pooled-connection proxy (e.g. PgBouncer/Neon pooled connection string) so concurrent serverless invocations don't each open their own Postgres connections, or (b) a properly-debugged batched endpoint with a confirmed root cause for the hang before re-attempting. Explicitly deferred by the user.
