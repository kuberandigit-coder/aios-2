# Reusable Prompts — Dilaksi Requirement 3 (All Collections "Pages for Removal" page)

**Page:** https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req3-pages-for-removal.html
**Builder (single source of truth):** `reports/dilaksi/data/2026-07-03_req3-allcol-page-builder.py`
**Data CSVs:** `reports/dilaksi/data/2026-07-03_req3-allcol-*.csv` + `2026-07-03_req3-all-collections-sitemap.csv`
**Copies:** `reports/digital-marketing-member-pages/pages/dilaksi-req3-pages-for-removal.html` (deployed) + `reports/dilaksi/dilaksi-requirement-3-pages-for-removal.html` (archive)

Paste any prompt below into Claude Code. Each assumes CLAUDE.md AIOS rules (real data only, evidence/validation/closure files, commit + push after completion).

---

## 1. FULL REFRESH — rebuild the whole page with fresh data
```
Refresh the Dilaksi Req 3 all-collections page end to end:
1. Fetch the live collection URL list from https://ledsone.co.uk/sitemap.xml → sitemap_collections_1.xml (UK URLs only, no /es/ /pl/ /nl/) → overwrite 2026-07-03_req3-all-collections-sitemap.csv (rename file to today's date and update the builder paths).
2. GA4: one bulk query — landingPagePlusQueryString begins with /collections/, sessionDefaultChannelGroup = Organic Search, last 12 months to today, property 408110563, key C:\Users\PC\.keys\ga4-service-account.json → allcol-ga4-organic-12m.csv (aggregate ?page= variants per handle, keep exact-URL split).
3. GSC: Search Analytics API, dimension=page, filter page contains /collections/, same 12m window, property sc-domain:ledsone.co.uk, same key → allcol-gsc-12m.csv (impressions + clicks per handle).
4. Semrush MCP: backlinks_pages report, target ledsone.co.uk, root_domain, sorted backlinks_num_desc, display_limit 1000 — confirm the tail reaches 0 backlinks so unlisted = verified 0 → allcol-semrush-backlinks.csv.
5. HTTP-check every collection URL individually at 1.2s spacing with retry on 429 (site bot protection blocks faster) and retry DNS errors → allcol-http-titles.csv (status + <title>).
6. Parse the homepage <header>/<footer> for /collections/ links → allcol-navlinks.csv.
7. Run the builder script to regenerate both page copies, then commit, push origin, and deploy per the deploy prompt. Save AIOS evidence/validation/closure. Never invent any number; unavailable source = explicit "Pending" marker.
```

## 2. REBUILD ONLY — data unchanged, layout/logic edits
```
Edit the Dilaksi Req 3 page builder (reports/dilaksi/data/2026-07-03_req3-allcol-page-builder.py) to make this change: <DESCRIBE CHANGE>. Rerun it to regenerate both page copies from the existing CSVs (do not refetch any data), verify the output locally, then commit, push, and deploy with my approval.
```

## 3. REFRESH ONE SOURCE ONLY
```
Refresh only the <GA4 | GSC | Semrush backlinks | HTTP live-status | nav links> data for the Dilaksi Req 3 page: rerun just that fetch step from the full-refresh prompt, overwrite its CSV, rerun the builder, commit, push, deploy with approval. Leave all other CSVs untouched and note the mixed data dates in the page footnotes.
```

## 4. DEPLOY (current known-good method — git integration is disconnected)
```
Deploy the dashboard: cd "C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages" then `vercel deploy --prod --yes`. After it returns READY, verify https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req3-pages-for-removal.html returns HTTP 200 and contains the expected row count. Also push the dashboard subtree to the shared repo: git subtree split --prefix="reports/digital-marketing-member-pages" -b tmp && git push staff tmp:main && git branch -D tmp.
Note: if a deploy hangs in "Building" for more than ~2 minutes, check `vercel ls` for a stuck deployment blocking the queue and `vercel rm <stuck-url> --yes` it (this happened 2026-07-03 after a broken git integration).
```

## 5. RECOMMENDED ACTION COLUMN (blocked — needs Kuberan's rule)
```
Kuberan has approved this business rule for the Req 3 Recommended Action column: <STATE THE RULE, e.g. "0 sessions + 0 impressions + 0 backlinks + not nav-linked for 12m = Remove; low traffic but has backlinks = 301 redirect to nearest parent collection; nav-linked = Keep">. Implement it in the builder as a computed column with the rule stated in the footnotes, regenerate, and deploy with approval. Do not extend the rule beyond what is written here.
```

## 6. ZERO-SIGNAL / REMOVAL-CANDIDATE REPORT
```
From the Dilaksi Req 3 CSVs, produce a focused removal-candidates report: all collections with 0 GA4 sessions, 0 GSC impressions and 0 backlinks in the last 12 months, plus a second tier with sessions < 5 and impressions < 100. Include per row: URL, title, nav-linked status, and which signals are zero. Save as a dated .md in reports/dilaksi/ — analysis only, no page changes, no deletions.
```

## 7. VERIFY LIVE PAGE (quick health check)
```
Verify the Dilaksi Req 3 page in production: fetch https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req3-pages-for-removal.html, confirm HTTP 200, the row count matches the builder's last output, no "Pending" markers remain except any documented ones, and the search + column-sort controls are present in the HTML. Report PASS/FAIL with what you found.
```

## 8. ADD A NEW DATA COLUMN
```
Add a "<COLUMN NAME>" column to the Dilaksi Req 3 page from this real source: <GA4 metric | GSC metric | Semrush report | Shopify GraphQL field>. Follow the existing pattern: fetch to a new dated CSV first, merge in the builder, per-cell layout = bold value + grey explanation + uppercase source label, document method in the footnotes, regenerate both copies, deploy with approval. If the source is unavailable, use an explicit "Pending — <source>" marker instead of any estimate.
```

---
*Created 2026-07-03 after the all-collections rebuild. Owner: Kuberan. If file paths change, the builder header comments are the authoritative reference.*
