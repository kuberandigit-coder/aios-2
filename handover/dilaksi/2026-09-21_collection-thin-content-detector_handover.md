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
