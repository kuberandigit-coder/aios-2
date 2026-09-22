# Handover — Collection Page Thin-Content Detector, Level 1

Date: 2026-09-21
Owner: Dilaksi (requested by Kuberan)
Reviewer: Kuberan

## What was implemented

Level 1 ONLY: audit -> priority -> backlog workflow for LEDSone UK collection pages. Pipeline: Shopify
Collection Data -> Content Extraction -> Word Count -> Threshold Check -> FAQ Content/Schema Check -> GSC
Search Performance -> Priority -> Content Backlog.

## Where

- Backend: `backend/app/dev_tasks/collection_thin_content/` (7 files: `__init__.py`, `content_analysis.py`,
  `content_fetch.py`, `gsc_metrics.py`, `schema.py`, `priority_rules.py`, `router.py`).
- Frontend: `frontend/src/admin/pages/dev-tasks/CollectionThinContentDetector.jsx`.
- Wired into `dev_tasks/__init__.py`, `taskRegistry.js`, `AdminLayout.jsx`, `DevLayout.jsx` — appears under
  Development Tasks exactly like every other dev tool, same UAM/permission gating (no new permission
  system).

## How it works

1. `content_fetch.fetch_collections()` pulls all LEDSone UK collections live from Shopify Admin API
   (read-only Query, paginated).
2. `content_analysis.analyze_collection_content()` strips HTML, counts words, checks FAQ content (regex)
   and FAQ schema (JSON-LD `"@type":"FAQPage"` string match) SEPARATELY.
3. `gsc_metrics.fetch_collection_gsc_metrics()` pulls 30-day GSC clicks/impressions/CTR/position for every
   `/collections/...` URL, matched by normalized path.
4. `priority_rules.compute_priority()` combines word count vs configured threshold, FAQ status, and GSC
   clicks vs configured traffic threshold into a deterministic HIGH/MEDIUM/LOW/NO ACTION/NOT CONFIGURED
   result with a fixed reason string.
5. Each collection's result is upserted into `collection_thin_content_audit`, which doubles as the content
   backlog (has its own `review_status`, `created_at`, `last_audit_at`).

## Data sources

- Shopify Admin API (`shopify_client.graphql`, store `ledsone_uk`) — collection id/title/handle/url/
  description/updatedAt. `collection_status` is always `None` (Shopify has no status field for collections).
- Google Search Console (`google_client.query_gsc`, site `sc-domain:ledsone.co.uk`, 30-day window) — clicks/
  impressions/CTR/position per collection URL.

## Business rules / thresholds

- **Minimum word count** and **high-traffic click threshold** did NOT exist anywhere in this project before
  this task. Both are stored in `collection_thin_content_config`, NULL by default. **Must be set by the
  user** (Config tab in the UI, or `PUT /api/dev/collection-thin-content/config/{min_word_count |
  high_traffic_clicks}`) before priority results become meaningful — until then, every collection reads
  `NOT CONFIGURED`.
- Priority logic (fixed, deterministic, in `priority_rules.py`):
  - HIGH = thin content + high traffic
  - MEDIUM = thin content + low traffic (or traffic unknown)
  - LOW = missing FAQ only (content not thin)
  - NO ACTION = meets threshold + has FAQ
  - NOT CONFIGURED = word-count threshold not set

## Current status

Live-tested end-to-end against real Shopify (490 collections) + real GSC data (1,114 matched URLs).
Backend imports cleanly, frontend builds cleanly. Both thresholds are currently unconfigured (by design) —
the dashboard will show all collections as "NOT CONFIGURED" until a real business threshold is entered by
the user. **Not yet committed to git.**

## Known issues / limitations

- No click-through browser test was performed in this session (no running dev server available here) —
  component logic and build output were verified instead.
- Traffic threshold and word-count threshold need a real business decision from the user; nothing was
  guessed.
- FAQ schema detection only recognizes JSON-LD `FAQPage` markup; it does not evaluate microdata/RDFa FAQ
  schema variants (uncommon on this platform, but noted for completeness).

## What is intentionally NOT implemented (Level 2/3)

AI content generation, content brief generation, FAQ suggestion generation, live/before-after collection
page preview, human approval workflow tied to a preview, automatic Shopify content updates, any Shopify
write operation, automatic publishing, content rewriting, post-implementation re-audit verification.

## Next step

User sets both thresholds via the Config tab, runs a Refresh Audit, and reviews the resulting Priority/FAQ/
Traffic/Backlog tabs. Recommended next level: Level 2 (content gap analysis + content brief/FAQ suggestion
generation) — still no Shopify writes, planning/review layer only.

## UPDATE (2026-09-21, later)

Several follow-up fixes/additions made after the user reviewed the live page:

1. **UI fixes**: every tab was rendering the identical generic table (confusing — switching tabs looked
   like nothing changed). Fixed with distinct, purpose-built columns per tab (Priority Analysis shows
   Priority+Reason sorted by severity; Traffic Analysis shows Clicks/Impressions/CTR/Position sorted by
   traffic; Content Backlog has an inline status dropdown), plus a one-line subtitle per tab.
2. **Root-cause CSS bug found and fixed**: the table markup was never wrapped in the existing
   `.jreq-scroll` container, so none of this dashboard's sticky-header/border/padding/hover/truncation
   styling applied at all — explained the "plain, unstyled" look the user saw. Also fixed two silent
   styling bugs found in the same pass: the active-tab class name didn't match the CSS (`active` vs
   `is-active`), and MEDIUM priority pills referenced a non-existent CSS class (should be `-amber`, not
   `-orange`).
3. **Config tab redesigned** as two side-by-side threshold cards (Configured/Not Configured status pill,
   unit suffix in the input, Save button disabled until the value actually changes) instead of stacked
   full-width blocks.
4. **Tab bar redesigned** as a segmented control with a live row-count badge per tab, scoped via a new
   CSS modifier class so the shared `.jreq-view-tab` style used by other pages (e.g. Internal Linking
   Suggestion Engine) is untouched.
5. **Search box**: already matched title + URL as a substring (so pasting a full/partial URL already
   worked); added collection handle to the match and clarified the placeholder text.
6. **Automatic 15-day audit refresh added**, in addition to the existing manual "Refresh Audit" button
   (kept exactly as-is per explicit instruction — user triggers it manually when needed). New
   `backend/app/dev_tasks/collection_thin_content/scheduler.py`: does not reuse `ScheduledSnapshot`
   as-is (that helper assumes one JSON blob per snapshot table plus a `sales_cache.sync_history`/
   `sync_control` row — the Sales/Employee-Performance Sync Monitor's own schema — whereas this task
   upserts real per-collection rows directly into `collection_thin_content_audit`, so there's no single
   payload to hand it and no reason to appear in that unrelated Sync Monitor UI). Reuses the same proven
   approach instead: anchors the next run to the last actual audit success (not a flat sleep, which
   drifts), catches up if a run was missed while the server was down, never blocks, logs failures instead
   of dying silently. New endpoint: `GET /api/dev/collection-thin-content/schedule`, surfaced in the UI
   next to "Last updated" as "Auto-refreshes every 15 days (next: ...)".
7. **User set real threshold values** via the Config tab: Minimum Word Count = 300, High Traffic
   Threshold = 10 GSC clicks (30 days). These are real business decisions made by the user, not invented
   by this task — recorded here for reference since they now drive every priority classification.

All changes committed to `dev-work` (commits `bb84261`, `584332d`, `e1ec5af`, `70d9669`, `f0ca5f1`,
`f5f7625`) and pushed to remote on explicit "push" instruction each time.

## UPDATE (2026-09-22) — Performance fix, Sync Monitor, AI FAQ generation feature, workflow restructure

Large batch of follow-on work since the last update. Level 1's own closure
(`closure/dilaksi/2026-09-21_dilaksi_collection-thin-content-detector-level1_closure.md`) is NOT reopened —
everything below is either a Level-1 bug fix or a separate, later-requested capability (FAQ schema
generation) added on top, not a re-scoping of Level 1 itself.

### 1. Audit performance fix (`9fd8347`)
Root cause found live (not guessed): `upsert_audit_row()` opened a separate connection + transaction +
commit per collection — 490 sequential commits measured at ~716ms each (~350s alone), the majority of a
reported "10+ minutes" audit runtime. Fixed with `schema.bulk_upsert_audit_rows()` (single `unnest()`
round-trip for all rows). Live-verified: full 490-collection audit now completes in ~22 seconds.

### 2. Registered in Sync Monitor (`5472767`, later corrected by `5aecede`)
Superseded the standalone scheduler mentioned in the note above — now uses the same `ScheduledSnapshot`
helper `competitor_analysis`/`geo_visibility` already use, giving Run History/pause-resume/manual Run Now
through the existing Sync Monitor page (Dev → Sync Monitor → "Dev — Collection Thin-Content Detector",
scope `collection-thin-content`) instead of a one-off UI. **Bug found and fixed (`5aecede`)**: the
snapshot's summary payload included a raw Postgres `datetime` object, which `json.dumps` can't serialize —
every single scheduled run failed with "Object of type datetime is not JSON serializable" (24 failed runs
in Run History), and because no run ever succeeded, the schedule kept retrying every few minutes instead of
respecting the real 15-day interval. Fixed by converting the timestamp to an ISO string before returning;
live-verified via `json.dumps()` on the exact same payload.

### 3. AI FAQ generation added (FAQ Analysis tab, `17e9f03` onward) — NOT part of Level 1
Per later explicit instruction. Multiple design iterations, in order:
- First built as full HTML content + FAQPage JSON-LD (matching the user's own supplied prompt).
- **Reverted to schema-only** (`10fa419`) per explicit instruction — no visible HTML/FAQ content generated
  or previewed, JSON-LD FAQPage schema only.
- **Reliability fix** (`755f332`): generation was originally synchronous, holding the HTTP connection open
  for the full ~60-90s AI call — the exact anti-pattern `background_job.py` exists to prevent (breaks
  through a proxy's shorter idle timeout as "Failed to fetch"; closing the modal lost all progress since
  state lived only in that one request). Converted to a real per-collection `BackgroundJob`; live-verified
  end-to-end (POST returns instantly, job completes server-side, status poll tracks it to completion).
- **Script-tag bug** (`45279ae`): copied output was bare JSON with no `<script type="application/ld+json">`
  wrapper — confirmed via the user's own before/after screenshots that pasting it into Shopify rendered as
  visible page text instead of invisible structured data. Fixed: output is now always the full wrapped
  block, with the inner JSON validated/re-serialized so a malformed AI response can never be pasted through
  broken.
- **Accordion preview** (`ed5b3aa`, `39aabeb`): raw JSON-LD code view replaced with a real expand/collapse
  accordion parsed from the schema itself; any internal-link URL mentioned in an answer renders as a real
  clickable link (using the real matched page's title) in the preview only — the underlying schema text
  stays plain, since structured data is never rendered as a page.
- **Internal links**: reinstated as a toggle (`54e88c3`), then per explicit instruction simplified to
  "included by default + a free 'Remove Internal Links' button that edits the existing schema without a new
  AI/PAA credit" (`652224c`). **Reliability fix** (`f314d5b`): confirmed live that the AI ignores the "mention
  a link" soft instruction fairly often — added `ensure_internal_link_present()`, a deterministic fallback
  that appends a link itself when the model's output has none. **Accuracy fix** (`5cd7319`): "Internal Links
  Used" was reporting all ~3 candidate pages offered to the model, not the (usually 1) actually mentioned —
  now filtered to only links genuinely present in the final text.
- **3rd Scrape.do token** (`5edba39`): `SLOT_ENV`/`PAA_MAX_ATTEMPTS_PER_PRODUCT` generalized so automatic
  failover (quota exhausted/rate-limited/auth-failed) reaches a 3rd configured slot, not just 2 — shared
  with the existing product-level FAQ system. User added `DILAXI_SCRAPE_API_TOKEN_3` to production `.env`;
  live-confirmed via `/faq-quota` all 3 slots active (620/1000, 1000/1000, 1000/1000 at time of writing).
- **429 fix** (`2f20385`): checking all 3 slots' balances back-to-back tripped Scrape.do's own rate limit on
  their `/info` endpoint (independent of real PAA credit usage) — user-reported via screenshot showing all 3
  slots erroring simultaneously. Fixed with retry-with-backoff + a small stagger between slot checks;
  live-verified all 3 now return real balances reliably.
- Real Scrape.do credit balance surfaced in the Config tab (`3490028`, `62c5bbc`) — live `/info` endpoint
  (confirmed not to itself cost a credit), summed total across all configured tokens, explains the
  auto-switch behavior.

### 4. Workflow restructure (`9848da1`) — per explicit instruction
- Checkbox selection added to the Collections tab (+ select-all-on-page); once anything is checked, every
  OTHER tab (Traffic Analysis, FAQ Analysis, Content Backlog, History) scopes down to only the selected
  collections.
- **Priority Analysis tab removed** — Priority is already a column on every other tab, so the dedicated tab
  was pure duplication.
- New tab order matching the real workflow: Collections → Traffic Analysis → FAQ Analysis → Content Backlog
  → History → Config (reordered twice per explicit instruction, `a197dc3` moved FAQ Analysis before
  Content Backlog).
- **New Implement/Verify/History workflow**: "Mark Done" (Content Backlog + detail modal) records who
  applied a change in Shopify manually and when — tracking only, never a Shopify write. "Verify" (History +
  detail modal) does a live, read-only re-fetch from Shopify + re-analysis, comparing the real current page
  against the configured threshold/FAQ requirement — never marks something Verified just because a user
  said so (live-tested: correctly reported "Still Thin" against unedited test data). New History tab: every
  Done collection, who did it, when, live verification status. New columns on `collection_thin_content_audit`:
  `implementation_status`, `implemented_by`, `implemented_at`, `verification_status`, `verified_at`.
- **Removed the redundant Backlog Status (`review_status`) dropdown** (`28c5097`) once the
  Mark-Done/Verify workflow made it fully redundant — per explicit user observation ("why this need, I
  think this is unwanted"). Deleted the dead `PUT /collections/{id}/status` endpoint and
  `schema.update_review_status()`; the DB column itself was left in place (harmless, unused) rather than
  dropped.

### 5. Smaller fixes
- URL columns across all tabs are now clickable links (`4451906`), not plain text.
- FAQ schema code block was overflowing the modal, forcing horizontal scroll — fixed with a wrapping CSS
  modifier class scoped so the Blog HTML Editor's diff view (same base class) is unaffected (`4451906`).
- Search box already matched title+URL as a substring; added handle matching + clarified placeholder
  (`f0ca5f1`).

### Current real config (as of 2026-09-22)
Minimum Word Count = 300, High Traffic Threshold = 10 GSC clicks (30 days) — both real business decisions
made by the user. 3 Scrape.do tokens configured and active. Auto-sync now succeeding on the corrected
15-day schedule.

### What is still intentionally NOT implemented
Same Level 1/2/3 boundary as before: no automatic Shopify writes anywhere (FAQ generation, Mark Done, and
Verify are all tracking/read-only), no live before/after collection-page preview, no automatic publishing.
