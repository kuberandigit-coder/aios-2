# Evidence — Dilaksi Req1 & Kamsi Req3: Same-Date Data Sync + Two Latent Bugs Fixed

**Date:** 2026-07-07
**Purpose:** Kuberan noticed Dilaksi Req1 and Kamsi Req3 are the same underlying report (Core GA4 Data for SEO, live rolling-window switcher, same store) but showed different numbers because they were last generated on different dates (Dilaksi: 2026-07-02, Kamsi: 2026-07-06). Requested both be refreshed to the same date for direct comparability.

## What was done

1. Reran both fetch scripts back-to-back so both reports reference the same "today":
   - `reports/dilaksi/data/2026-07-02_req1-ga4-multiwindow-fetch.py`
   - `reports/Kamsi/data/2026-07-06_kamsi_req3_ga4_multiwindow_fetch.py`
   - Confirmed identical page counts/sessions/revenue at every window (e.g. 60-day: 4,547 pages, 15,890 sessions, £15,800.71 on both).

## Two latent bugs found and fixed while doing this

**Bug 1 — Dilaksi Req1's GSC query column was silently getting wiped on every rebuild.** The builder (`2026-07-02_req1-page-builder.py`) carried forward query strings by regex-scraping literal `<td class="lp">...</td><td class="q">...</td>` HTML from the previously-generated page. But the page renders its table client-side via JS from an embedded `DATA` JSON object — there are no literal `<td>` rows in the saved file. The regex matched almost nothing (1 entry) instead of the ~43 real query mappings that actually exist in the embedded JSON. Fixed by parsing `const DATA = {...}` directly and pulling `[landing_page, query]` pairs from every window's `r` rows instead.

**Bug 2 — the same builder's template never included the tab-nav/back-button markup.** That markup had been added to `dilaksi.html` manually in an earlier task, outside this builder. Every time the builder reran (as it does whenever the data needs refreshing), it silently regressed both back to a plain-text link with no tab-nav — this was the actual root cause of a styling regression caught and patched around in a previous session. Fixed by adding the tab-nav/back-button directly into the builder's `PAGE` template so it now survives every rebuild.

Both builders' hardcoded "Generated: 2026-07-0X" date labels were also updated to the actual fetch date (2026-07-07).

## Result

Both pages regenerated with matching, comparable data and correct dates. Verified live: `dilaksi.html` shows `Generated: 2026-07-07`; `kamsi-req3-core-ga4-seo.html` shows the same 60-day session total (15,890) as Dilaksi.

## Deployment

Pushed to Staff-requirements as commit `c5588ce` (author: digitalmarketing). Live at `https://digital-marketing-member-pages.vercel.app/pages/dilaksi.html` and `.../pages/kamsi-req3-core-ga4-seo.html`.
