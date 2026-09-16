## Alt Text Optimization (continued) & Meta Title/Description Audit — Handover

**What was implemented:** A long series of live bug fixes and feature
additions to two existing dm-dashboard Development Tasks — Alt Text
Optimization (continuing from 09-15) and Meta Title & Description Audit
(relocated today from Dilaksi's own pages into Development Tasks, then
extensively built out with a manual-keyword AI generation workflow).

**Where it is:**
- Alt Text Optimization: `backend/app/dev_tasks/alt_text_keywords/`, `frontend/src/admin/pages/dev-tasks/AltTextKeywordFinder.jsx`. Unchanged location.
- Meta Audit: `backend/app/dev_tasks/meta_audit/` (moved today from `backend/app/dilaksi_meta_audit.py`), `frontend/src/admin/pages/dev-tasks/MetaTitleDescriptionAudit.jsx` (moved today from `frontend/src/dilaksi/pages/`). Registered under Admin → Development Tasks, gated by User Access Management only (`tools.DevMetaTitleDescriptionAudit`, no `ownerStaffKey`).
- Git: all committed to `dev-work`, merged into `main` today via the in-app Dev Tools branch-merge feature. `main` tip `c46c32b` confirmed (via `git log`/`git merge-base`) to include every commit from today.

**How Alt Text Optimization works now:**
1. Selecting a collection loads instantly from a permanent cache; only genuinely-missing (not duplicate-of-title) images get generated.
2. Generation runs as a background job (never blocks the page), capped at 50 products per visit — re-selecting the same collection auto-continues with the next 50, since cached products naturally drop out of the pending list.
3. Local LLM tried first, Gemini as automatic fallback if it's down — currently up and working (verified live, host is `qwen3next.severdigitweb.uk`, no underscore).
4. A "Run Collections" tab shows every collection's progress; Stop/Resume controls the background job.
5. A failed generation now shows the real error reason instead of an infinite spinner (was the root cause of collections that appeared permanently "stuck").

**How Meta Audit's new keyword-generation workflow works:**
1. Missing Metadata tab: type/paste one or more comma-separated keywords into a product's input, click Generate.
2. Backend always generates BOTH a title and description (never Shopify-writing, so no risk in generating "extra" text) via the local LLM (Gemini fallback), using the user's two exact fixed prompts, with all typed keywords woven in.
3. Every successful generation is auto-saved as that product's keyword shortlist and logged (who, what, when, which keywords) in the new "Generated Titles/Descriptions" tab, which supports delete-per-entry.
4. Real keyword research (when done) comes from the Semrush MCP connector, used interactively by an agent in a chat session — this account's Semrush plan doesn't include Standard API access (confirmed live: HTTP 403 with a valid, correctly-formatted key), and the MCP connector itself cannot be called by the deployed backend, only by a live agent session. This is a documented, accepted limitation, not a bug.

**Data sources:** Shopify Admin API, GA4 Data API, self-hosted local LLM (Qwen3-Next) + Gemini fallback, Semrush MCP connector (interactive-only). No Keyword Planner, no Google Ads API.

**Important logic to know:**
- Meta Audit's Generate button always produces both fields now — the earlier `missingTitle`/`missingDescription` conditional logic was removed entirely per explicit instruction.
- Generated titles are normalized to end in `" | LEDSone"` regardless of what separator the model actually used — this is enforced by a regex safety net (`_normalize_brand_separator`), not just a prompt instruction, since prompt compliance alone wasn't reliable across models.
- The `meta_audit_keyword_candidates` table stores keyword text only (no Semrush metrics) — this was a deliberate simplification; it does NOT reduce Semrush API cost by itself (that's a common misconception — cost is per-lookup, not per-column), but was requested and implemented anyway for a cleaner UI/DB.
- Production database access is now correctly configured on this dev machine (`DATABASE_URL` was pointing at `localhost` when it should have pointed at the real server — same credentials, wrong host, now fixed) — this enabled direct verification/fixes against real production data throughout today's session.

**Current status:** Both workstreams implementation-complete and merged to `main`. Alt Text confirmed working live multiple times today (local LLM DNS fix specifically re-verified after the user applied it to production). Meta Audit's earlier commits confirmed live via direct production `curl`; the very latest commits (multi-keyword input, generation log, brand separator, always-generate-both) are confirmed merged to `main` via git but not independently re-curled/re-browser-tested after this documentation was written.

**Known issues:**
1. Semrush Standard API access requires a Business-tier plan upgrade if real-time, self-serve keyword lookup inside the live dashboard is ever wanted — current workflow requires an agent chat session for keyword gathering.
2. Whether the production server has pulled/rebuilt the very latest merged commits is not independently re-confirmed in this documentation pass (last confirmed mid-session, for an earlier commit range).
3. Production Postgres is reachable from the open internet with just a username/password (no IP allowlist) — flagged to the user earlier this session as a security gap worth locking down, not yet actioned.

**Remaining work:**
1. Confirm the production server has the very latest commits deployed (re-curl or re-check the live page).
2. Consider the Semrush Business-tier upgrade if live self-serve keyword lookup becomes a priority.
3. Consider locking down Postgres network access (IP allowlist/firewall).

**Owner:** Kuberan. **Requester:** Kuberan (internal dev tooling, not staff-specific).
