# Evidence — Kamsi Req 3: GA4 Engagement Rate Bug Root-Caused & Fixed

**Date:** 2026-07-06/07
**Purpose:** Diagnose and fix a data-quality bug in Kamsi's Requirement 3 report (Core GA4 Data for SEO) where Engagement Rate showed exactly 100% for all 242 pages, and rebuild the page to match Dilaksi Requirement 1's proven pattern per Kuberan's request.

## Investigation

Initial hypothesis (GA4 property/GTM misconfiguration) was **wrong** and corrected after comparing Kamsi's fetch script against Dilaksi Req1's working fetch script line-by-line.

**Root cause, confirmed via isolated test queries against the live GA4 Data API:**
- Dilaksi Req1's fetch (`2026-07-02_req1-ga4-multiwindow-fetch.py`) filters by **only** `sessionDefaultChannelGroup = Organic Search` (a single `FilterExpression`).
- Kamsi Req3's original fetch (`2026-07-06_kamsi_req3_ga4_gsc_fetch.py`) combined that channel filter **and** a `landingPagePlusQueryString CONTAINS "/collections/"` filter inside one `and_group` (`FilterExpressionList`).
- Test queries proved: single-dimension queries (no channel filter) return genuine varying engagementRate (0.96–1.0). Adding the channel filter alone via `and_group` with any second condition collapses `engagementRate` (and even the raw `engagedSessions` count) to exactly equal `sessions` for every row — a GA4 Data API quirk triggered specifically by that filter combination, not a property-side/GTM issue.

## Fix

Rebuilt Kamsi Req3 to be structurally identical to Dilaksi Req1:
- New fetch: `reports/Kamsi/data/2026-07-06_kamsi_req3_ga4_multiwindow_fetch.py` — single Organic Search filter, ALL organic landing pages (not restricted to /collections/), 5 rolling windows (60/45/30/15/7 days), top 200 by sessions per window.
- New GSC fetch: `reports/Kamsi/data/2026-07-06_kamsi_req3_gsc_allpages_fetch.py` — top query per page across all pages (previously restricted to /collections/), 5,525 query-map entries.
- Rebuilt `reports/Kamsi/data/2026-07-06_kamsi_req3_page_builder.py` to match Dilaksi's live 5-window switcher, same card/table layout and columns, plus added Page Type (Collection/Blog/Other) and Collection filter dropdowns.

**Verified fix:** engagement rate now shows real variance — 93.9% (7d) to 95.1% (60d) across windows — instead of a flat 100%.

## Also fixed this session

- **Hetheesha tabs:** trimmed placeholder Requirement 4/5 tabs after Piranav added a real Requirement 3 (Duplicate Page Analysis, commits 9541233/dda0a20/5b980b5) — merged his work in first via `git fetch`/`git merge` before trimming, per the "sync before push" rule.
- **Dilaksi back-button regression:** found `dilaksi.html` and `dilaksi-req3-pages-for-removal.html` had regressed to a plain-text back link (losing the bordered-button style from an earlier task) and `dilaksi.html` had a corrupted duplicate closing tag (`</body></html>` followed by a stray `body>\n</html>`). Restored both from the shared repo's clean deployed copy rather than my locally-corrupted version.

## Deployment

Pushed to shared repo `Staff-requirements` as commit `ec07b4c` (author: digitalmarketing). Verified live: `https://digital-marketing-member-pages.vercel.app/pages/kamsi-req3-core-ga4-seo.html` shows `"t":[15994,11491,0.9508...` (95.08% engagement, 60-day window) and Hetheesha's page shows exactly Requirement 1/2/3.
