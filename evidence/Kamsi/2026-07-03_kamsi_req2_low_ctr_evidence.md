# Evidence — Kamsi Requirement 2: Low CTR Page Identification

**Title:** Kamsi Req 2 evidence · **Date:** 2026-07-03 · **Owner:** Kamsi · **Reviewer:** Kuberan
**Purpose:** Record discovery, collection and build. **Requirement Source:** Google Sheet/screenshot via Kuberan.
**Business Question:** Which collection and blog pages have high search visibility but low CTR and need SEO improvement?
**Status:** Delivered locally — deploy pending Kuberan approval.

## Step 1 — Existing asset discovery
- Kamsi AIOS folders exist (Req 1, 2026-07-03). Kamsi "dashboard" = `pages/kamsi.html` hub linking report pages (Dilaksi pattern: one page per requirement, hub + index expander card). **Decision: EXTEND** the hub with R2 + **CREATE NEW** report page `kamsi-req2-low-ctr-pages.html`. No tabbed single-page dashboard exists, so the established hub-page pattern was followed (no duplicate truth created).
- Duplicate check: grep "low ctr / click-through" across AIOS → only hetheesha.html (Piranav's ledsone.fr top-selling report — different site, different requirement) and unrelated EOD docs. **Duplicate risk: none.**
- Housekeeping: found and deleted a stray untracked test clone `reports/digital-marketing-member-pages/staffreq-test/` (leftover from the 2026-07-03 deploy-trigger work; never committed, never deployed — live URL check 404).

## Step 2 — GSC data collection (read-only)
- Property: **sc-domain:ledsone.co.uk** (service account, Restricted). Month: **2026-06-01 → 2026-06-30** (most recent complete month; no partial data).
- Page-level totals: dimensions=[page], filter page contains /collections/, /blogs/, /blog/ (3 passes, deduped, re-checked in code) → **1,385 pages** (1,148 collections, 237 blog pages).
- Target keyword: dimensions=[page,query] same filters; keyword = highest-impressions query per page → 789 pages have a keyword; the rest show "—" (GSC anonymises rare queries).
- Fetch script: `reports/Kamsi/data/2026-07-03_kamsi_req2_gsc_fetch.py` → `2026-07-03_kamsi_req2_gsc_pages_2026-06.csv`.

## Step 3 — PostgreSQL read-only discovery
- Column scan (canonical/meta/seo_title/page_url/blog/gsc) across user schemas.
- Found: **google_search_console** schema — full GSC mirror (gsc_web_page, gsc_web_query_page, + image/news/video variants), covering sc-domain:ledsone.co.uk 2026-03-20→2026-06-30 (388,616 page rows) plus ledsone.de/.fr/vintagelite/electricalsone properties.
- Cross-check: PG June totals for the top blog page = **70 clicks / 26,370 impressions** — exactly matches the live API. **GSC API documented as the single source of truth for this report** (mirror used for verification only — no duplicate truth).
- No SEO title/meta-description/canonical tables found → PG enrichment not needed/available; not required for final metrics.

## Results (June 2026)
- **1,385 pages checked · 1,324 Low CTR (CTR < 2%) · 61 OK · average CTR 0.33% · 577,976 impressions · 1,894 clicks.**
- Flag applied verbatim; CTR converted to % with 2 decimals; positions 1 decimal.

## Files Created
- `reports/digital-marketing-member-pages/pages/kamsi-req2-low-ctr-pages.html` (+ archive `reports/Kamsi/kamsi-requirement-2-low-ctr-pages.html`) — Dilaksi design, 5 KPI cards, search, Flag/Page Type/CTR Range filters, sortable columns, CSV export, pagination (fast-render pattern from Req 1), last-updated stamp, responsive.
- `kamsi.html` hub → "2 reports" + R2 link · `index.html` Kamsi card → R2 button, "2 pages available".
- Data: fetch script + June CSV + builder.

**Evidence Location:** this file + data CSV. **Validation:** `validation/Kamsi/2026-07-03_kamsi_req2_low_ctr_validation.md`
**PostgreSQL Sources Checked / External Sources Checked:** as above.
**Known Limitations:** GSC omits zero-impression pages; 596 pages lack a visible query (anonymised) → keyword "—"; monthly snapshot (rerun fetch+builder for a new month).
**Next Steps:** Kuberan approval → deploy → live verify.
**PASS/FAIL:** PASS
