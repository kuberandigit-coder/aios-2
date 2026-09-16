## Title
Alt Text Optimization (continued) & Meta Title/Description Audit relocation + keyword workflow

## Date
2026-09-16

## Repo / Branch
dm-dashboard — all work committed to `dev-work`, merged into `main` today via the in-app Dev Tools branch-merge feature (multiple merge commits, final `main` tip `c46c32b` includes every commit listed below).

---

## Workstream 1 — Alt Text Optimization

### Files
`backend/app/dev_tasks/alt_text_keywords/{router.py,ai_alt_text.py,schema.py}`, `frontend/src/admin/pages/dev-tasks/AltTextKeywordFinder.jsx`.

### Real bugs found and fixed (root cause each)
1. **"Identical alt text" bug** — exact-filename matching between the AI's JSON response and requested filenames silently defaulted every unmatched image to the bare product title. Fixed with positional fallback (same-index entry used when filename doesn't match exactly) + numbered last-resort fallback + explicit `duplicateAltText` detection. Live-tested against a simulated mismatched-filename response — confirmed real distinct text recovered instead of duplicates. Commit `563b4d0`.
2. **Auto-generation scope too broad** — was generating for duplicate-of-title images too, not just genuinely missing ones, causing every row to show "Generating…" simultaneously and confusing the workflow. Split `_is_missing_alt` (drives generation) from `_is_weak_alt` (drives the "(same as title)" review flag only). Commit `c26f58f`.
3. **504 Gateway Timeout on large collections** — whole-collection generation ran inline inside the `GET keyword-evidence` request. Rebuilt as a non-blocking background job (`POST /generate`, `GET /generate/status` polling), matching this app's established background-job convention. Commit `d98d14a`.
4. **Generation failures silently mislabeled as "done"** — a failed generation returned `pending: False` even though nothing was cached, so the product looked finished when it had actually failed with no visible reason — this was the root cause of collections that stayed "in progress" indefinitely across multiple visits. New `public.alt_text_generation_errors` table persists the real error; failures now correctly stay `pending: True` (retried automatically) and the UI shows the actual reason instead of an infinite spinner. Commit `68e6738`.
5. **Local LLM outage #1** — self-hosted Qwen3-Next endpoint unreachable (confirmed via direct `curl`/`requests` test: `NameResolutionError`). Added automatic Gemini fallback (`ai_shared.call_gemini`, tried only after the local LLM fails) so generation kept working. Commit `1885637`.
6. **Broken production build** — `main` had committed references (`AdminLayout.jsx`, `DevLayout.jsx`, `taskRegistry.js`) to a `SeoSerpRankTracker` component whose actual files were never committed (present only as untracked local files on the dev machine) — any fresh deploy failed with `[UNRESOLVED_IMPORT]`. Per explicit instruction, removed the untracked local files and every import/registration reference rather than committing a teammate's unfinished work. Commit `aab79a8`. **Verified**: `grep` for the component name across the repo after the fix returns zero matches on `main`.
7. **Local LLM outage #2, real root cause found** — the configured `LOCAL_LLM_BASE_URL` used `qwen3_next.severdigitweb.uk` (underscore) — underscores are invalid in DNS hostnames, which is why resolution kept failing. Confirmed live: `https://qwen3next.severdigitweb.uk/v1/chat/completions` (no underscore) returned `HTTP 200` with a real model reply; the buggy underscore host was independently reproduced failing from both this dev machine and the live production server (via a direct `curl` to `https://dm-dashboard.vintageinterior.co.uk/api/dev/alt-text-keywords/...`). Local `.env`'s `LOCAL_LLM_BASE_URL` corrected; user applied the same fix to the production server's `.env` and restarted — re-verified working live afterward.

### Features added
- 50-product batch cap per collection visit with automatic continuation (already-cached products drop out of the "pending" list, so re-selecting the same collection naturally continues where it left off — no explicit cursor needed). Commit `5496425`.
- "Run Collections" tab — every collection ever opened for generation, with live progress and a jump-back-in button. New `public.alt_text_collection_runs` table. Commit `f03721b`.
- Stop/Resume for the background generation job — `POST /generate/stop` sets a flag the job's loop checks between products; Resume is just re-opening the collection, since stopped products remain uncached and are naturally first in the next batch. Commit `49e338f`.

---

## Workstream 2 — Meta Title & Description Audit

### Relocation (explicit correction)
Originally built as "Dilaksi Requirement 07" (see that separate prompt/evidence/etc. set). Per explicit instruction, moved entirely out of Dilaksi's own pages:
- Backend: `backend/app/dilaksi_meta_audit.py` → `backend/app/dev_tasks/meta_audit/` (proper `dev_tasks` package: `router.py` + `schema.py`, registered in `dev_tasks/__init__.py`'s aggregator router, same pattern as `alt_text_keywords`/`content_gap`). Route prefix changed `/api/dilaksi/meta-audit` → `/api/dev/meta-audit`.
- Frontend: `frontend/src/dilaksi/pages/MetaTitleDescriptionAudit.jsx` → `frontend/src/admin/pages/dev-tasks/MetaTitleDescriptionAudit.jsx`, registered as `tools.DevMetaTitleDescriptionAudit` (no `ownerStaffKey` — gated by User Access Management only, same as every other dev tool), added to both `AdminLayout.jsx` and `DevLayout.jsx`'s "Development Tasks" section. Every Dilaksi-specific registration (sidebar entry, import, panel, taskRegistry entry) removed.
- Commit `4b3e788`. Snapshot table renamed `public.dilaksi_meta_audit_snapshot` → `public.meta_audit_snapshot` (never deployed under the old name, so no migration needed).

### UI/UX iteration (all live-verified via `npx vite build`, several via live production `curl`/browser)
- Duplicate-metadata detail popup (click "N other URLs" → full list with page type), filters (Page Type/Field/search) on every tab, pagination (50 rows/page) for large result sets (this store has 650+ duplicate rows, thousands of backlog rows), smooth tab-switch fade transition. Commits `d5323b9`, `64d5639`.
- Redesigned tab bar (pill style, live count badges), overview KPI layout (hero card + priority strip + grouped sections), URL link styling (domain de-emphasized, path emphasized). Commit `f0f5666`.

### New feature — manual-keyword AI generation (Missing Metadata tab)
- New module `backend/app/dev_tasks/meta_audit/generate.py`: the user's exact two prompt templates (title, ≤60 chars; description, ≤140 chars) filled with real per-product data, called against the local LLM with the same Gemini fallback pattern already proven in Alt Text Optimization. Commit `748c37a`.
- **Real bug found and fixed**: Gemini's response format (markdown bold + a separate "**Character count:** N" line) wasn't handled by the original regex-only cleaner — inflating the reported character count and wrongly flagging valid titles as over-limit. Rewrote `_clean()` to work line-by-line, verified against 4 real response shapes. Commit `551f8c0`.
- **Real bug found live in the browser**: clicking Generate on a row that already had a saved keyword did nothing — confirmed via the Chrome DevTools network tab showing **zero requests fired** on click. Root cause: the input's displayed value fell back to the saved keyword, but the click handler only read a separate piece of React state that stayed `undefined` until the user manually retyped something. Fixed by passing the effective displayed value explicitly into the handler. Commit `9e57a28`.
- **" | LEDSone" brand separator enforced** — prompt rule added plus a regex-based safety-net normalizer (`_normalize_brand_separator`) that rewrites whatever separator the model actually used ("by LEDSone", "on LEDSone", no separator at all) to the required " | LEDSone" — verified against 6 real/simulated output shapes. Commit `7d6e96e`.
- **Always generates both fields** — per explicit instruction, Generate now always produces both a title and a description regardless of which was actually missing on Shopify (safe since this task never writes to Shopify). `missingTitle`/`missingDescription` flags removed from the request entirely. Commit `d04c604`.

### Semrush access investigation (real, live-tested findings)
- Manually created Semrush v4 API key tested directly against `api.semrush.com` — confirmed the correct auth header is `Authorization: Apikey <key>` (not `Bearer`) and the correct endpoint is `https://api.semrush.com/apis/v4/keywords/v1/metrics` (found via `developer.semrush.com`'s own docs, not guessed). With the correct format, the account received **`HTTP 403 Forbidden`** — traced to the account's Subscription info page: "The option to purchase API units is only available for Business users" — confirmed this Semrush plan does not include Standard API access, despite having 49,280 API units sitting in the balance.
- The Semrush **MCP connector** (a different, session-only authorization path) was confirmed working live (`phrase_this`/`phrase_related` reports returned real data) — documented as **interactive-only**: it cannot be called by the deployed backend, only by an agent in a live chat session. Investigated and explicitly declined a queue+cron workaround (flagged as fragile for a production feature).
- Real top-3 keyword shortlists gathered via the MCP connector and saved directly to the **production** database (see Database Changes) for 4 real products, each deliberately avoiding higher-volume but off-topic candidates (e.g. rejected "ceiling lights" at 60,500 vol/month in favor of "3 way ceiling light" at 140 vol/month, since the product's actual distinguishing feature is its 3-way switching — the same class of keyword-mismatch check already established earlier in Alt Text Optimization's "2 Core vs 3 Core" fix).

### Database changes (schema evolution, per explicit simplification instructions)
- `public.meta_audit_keyword_candidates` — created with full Semrush metrics (volume/CPC/KD%/intent/rationale) per URL+rank, then **simplified** to keyword text + rationale only, per explicit instruction ("only key word is enough... dont show the voloum cc and others"). Migrated directly on the live production table (columns dropped via `ALTER TABLE`), all 9 existing rows' keyword text/rationale preserved — verified by reading them back after the migration.
- `public.meta_audit_keywords` (the original single-keyword-per-field table) — fully replaced by the above, dropped from production directly (`DROP TABLE IF EXISTS`, called on every startup so it stays gone on redeploy).
- `public.meta_audit_generation_log` — new table, one row per successful generation (URL, field, generated text, character count, over-limit flag, keywords used, who ran it, when). `DELETE /generation-log/{id}` endpoint added for the log's Delete action.

### Production database access corrected (used for all direct verification above)
The local `.env`'s `DATABASE_URL` had `host=localhost` — this is actually the exact same production credentials (same username/password as the live server), just pointing at the wrong host (this dev machine's own local Postgres, not the server's). Corrected to point at the real production database host. **DATABASE_URL configured, verified working** (no credential values recorded here). This connection was used for every direct production read/write described above: dropping the old table, migrating the candidates table schema, and inserting real keyword data for 4 products — each insert immediately read back to confirm.

## Live test results (real, not simulated, except where noted)
- Local LLM connectivity: confirmed down twice, confirmed fixed both times via direct HTTP calls against the real endpoint.
- Meta title generation via local LLM: real call, `"3 Way Ceiling Light – Vintage Industrial Pendant"`, 61 chars, correctly flagged over the 60-char limit (honest reporting, not silently truncated).
- Meta title generation via Gemini fallback (local LLM forced to fail): real call, `"Orange Wall Sconce Light - Glossy Modern Retro | LEDSone"`, 56 chars.
- Multi-keyword generation: `"e27 lamp holder, lamp holder, bulb holder"` (3 comma-separated keywords) → real call → `"E27 Lamp Holder – 10pc Black Bakelite Bulb Sockets by LEDSone"` (61 chars, correctly flagged over-limit) — confirmed before the brand-separator fix; the fix itself verified separately against 6 sample strings, not re-run through the live LLM a second time.
- Production database round-trips: 4 products' keyword candidates inserted and read back; generation log table created and a test row inserted/read/deleted to confirm the schema round-trips correctly (test row removed afterward, not a real generation).
- Git state: `main`'s tip (`c46c32b`) confirmed via `git log`/`git merge-base` to include every commit listed above — fully merged, not just pushed to `dev-work`.

## Not independently re-verified in this documentation pass
- The very latest commits (`9de4ea4` keyword-only simplification onward through `d04c604`) were merged to `main` but their live-server deployment (server `git pull` + rebuild + restart) was not re-confirmed via a fresh `curl`/browser check after this documentation was written — earlier commits in this same chain (through roughly `551f8c0`) WERE confirmed live via direct production `curl` calls during the session itself.
- No full end-to-end browser click-through of the "Generated Titles/Descriptions" Delete button was performed (build-verified only).
