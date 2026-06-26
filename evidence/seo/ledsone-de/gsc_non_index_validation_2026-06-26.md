# GSC Non-Index URL Investigation — ledsone.de

| Field | Value |
|---|---|
| **Store** | ledsone.de |
| **Date** | 2026-06-26 |
| **Requested by** | Sukirtha (SEO team) |
| **Executed by** | Kuberan |
| **Task type** | Read-only SEO validation |
| **Result** | PARTIAL — API connected, bulk non-index endpoint not available in GSC API |

---

## What Was Done

### 1. GSC API — Service Account Setup (COMPLETE ✅)

| Item | Detail |
|---|---|
| Google Cloud Project | `ledsonede-gsc` |
| Service account | `ledsonede-gsc-reader@ledsonede-gsc.iam.gserviceaccount.com` |
| Permission granted in GSC | Restricted (read-only) for `https://ledsone.de/` |
| Key file | `ledsonede-gsc-7af8d5684e71.json` (in subfolder root, gitignored via `*.json`) |
| Connection test | PASS — `https://ledsone.de/` confirmed as `siteRestrictedUser` |

### 2. Sitemaps Discovered via API (COMPLETE ✅)

| Sitemap | Submitted URLs |
|---|---:|
| `sitemap.xml` (main index) | 8,749 |
| `sitemap_products_1.xml` | 2,422 |
| `sitemap_collections_1.xml` | 260 |
| `sitemap_pages_1.xml` | 158 |
| `sitemap_blogs_1.xml` | 77 |
| `it/` (Italian market) | products + pages + collections + blogs |
| `da/` (Danish market) | products + pages + collections + blogs |
| `de-pl/` (Poland market) | pages + collections |
| Total inspectable DE URLs | ~2,917 |

### 3. URL Inspection API — Tested (COMPLETE ✅)

Tested on homepage — confirmed working:

| Field | Value |
|---|---|
| URL | `https://ledsone.de/` |
| Coverage state | Submitted and indexed |
| Verdict | PASS |
| Robots | ALLOWED |
| Last crawl | 2026-06-25 |

### 4. Bulk Non-Index via API — Not Possible (FINDING ⚠️)

Investigated whether the GSC API exposes a bulk "not indexed" endpoint.

| API Method | Can get bulk non-indexed? | Reason |
|---|---|---|
| Search Analytics API | NO | Only returns pages with clicks/impressions (indexed pages) |
| URL Inspection API | NO (indirect only) | One URL at a time, 2,000/day limit — 2,917 URLs = 2+ days |
| Index Coverage/Pages API | NO | This report does not exist in the GSC API |

**Conclusion:** Google does not expose the "Why pages aren't indexed" bulk report via any API. This is a known GSC API limitation. The data only exists in the GSC UI.

---

## What the API CAN Do (Future Use)

| Task | API Method | Notes |
|---|---|---|
| Check if one specific URL is indexed | URL Inspection API | Instant, useful for spot checks |
| Search performance by URL (clicks, impressions, CTR, position) | Search Analytics API | Bulk, very useful |
| Sitemap submission status | Sitemaps API | Confirmed working |
| List GSC properties | Sites API | Confirmed working |

---

## Non-Index Report — Gap

The non-indexed URL list for Sukirtha was not extracted because the GSC API does not provide this endpoint.

**Required action (5 minutes):**
1. Open GSC → `https://ledsone.de/` → **Indexing → Pages**
2. Click **"Why pages aren't indexed"** tab
3. Export icon (top right) → **Download CSV**
4. Save to: `evidence/seo/ledsone-de/gsc_non_index_urls_2026-06-26.csv`
5. Claude Code reads it and produces the full report for Sukirtha

---

## Files Created This Session

| File | Purpose |
|---|---|
| `ledsonede-gsc-7af8d5684e71.json` | Service account key (gitignored) |
| `evidence/seo/ledsone-de/gsc_non_index_validation_2026-06-26.md` | This file |
| `.gitignore` updated | Added `*.json` to prevent key commit |

## Final Status

**PARTIAL** — API permanently connected and tested. Bulk non-index data requires one manual UI export. All other GSC data (analytics, sitemaps, URL spot-checks) can now be pulled via API on demand.
