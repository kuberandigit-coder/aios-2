# Evidence — Dilaksi Req 3: Recommended Action Column Populated

**Date:** 2026-07-06
**Purpose:** Fill the previously-blank "Recommended Action" column on Dilaksi's Requirement 3 (Pages for Removal — All Collections) report, using the business rule Kuberan supplied as a screenshot of a decision table.

## Rule supplied by Kuberan (verbatim conditions)

| # | Condition | Recommended Action |
|---|---|---|
| 1 | URL contains query parameters (?, &) AND Currently Live = Yes | Add canonical tag — do not delete |
| 2 | Currently Live = Yes (duplicate of [live page]) | 301 Redirect to [the live equivalent] |
| 3 | GA4 Sessions = 0 AND GSC Impressions = 0 AND Referring Backlinks = 0 AND Linked in Nav/Footer/Sitemap = No | Delete (410) |
| 4 | GA4 Sessions ≤ 20 AND Referring Backlinks ≥ 1 | 301 Redirect to nearest matching live collection/product |
| 5 | GA4 Sessions = 0 AND GSC Impressions > 0 AND Referring Backlinks = 0 | 301 Redirect to nearest matching live collection/product (has search visibility but no traffic) |
| 6 | Linked in Nav/Footer/Sitemap = Yes (regardless of traffic) | Keep — do not delete (structurally important, review content instead) |
| 7 | Everything else | Review manually (borderline — human judgment needed) |

Applied top-to-bottom per row, first match wins.

## Implementation notes

- **Condition 1 (query params):** checked against the sitemap URL list (`2026-07-03_req3-all-collections-sitemap.csv`) — confirmed 0 of 473 live collection URLs carry query parameters, so this condition never fires on the current dataset (logic still implemented for future runs).
- **Condition 2 (duplicate):** computed by grouping live (HTTP 200) pages by normalized page `<title>`. Found 10 duplicate-title groups (20 handles) — e.g. `bundle-deals` / `bundle-deals-1`, `flash-sale-up-to-70-off` / `flash-sale-up-to-70-off-1`. Within each group, the page with the higher GA4 sessions (tie-break: GSC impressions) is treated as "the live equivalent"; the other page(s) get `301 Redirect to /collections/<canonical-handle>`.
- **Conditions 4 & 5 ("nearest matching live collection/product"):** rendered as literal descriptive text, not a computed target — matching a removal candidate to its nearest live equivalent requires human/product judgment (category, keyword overlap) that isn't in the current data sources. Not invented.

## Result (473 live collections, 12-month window)

- Delete (410): **15**
- 301 Redirect (duplicate + low/no-traffic-with-signal): **173**
- Keep (linked in nav/footer): **64**
- Review manually: **221**
- Add canonical tag: **0** (no query-param URLs in current sitemap)

## Files changed

- `reports/dilaksi/data/2026-07-03_req3-allcol-page-builder.py` — added `recommended_action()` rule engine + duplicate-title detection, action pill styling, action filter dropdown, updated footnote methodology.
- `reports/digital-marketing-member-pages/pages/dilaksi-req3-pages-for-removal.html` — regenerated output (deployed).
- `reports/dilaksi/dilaksi-requirement-3-pages-for-removal.html` — regenerated secondary copy.

## Deployment

- Pushed to shared repo `Staff-requirements` as commit `10e67a4` (author: digitalmarketing, required for Vercel auto-deploy).
- Verified live at `https://digital-marketing-member-pages.vercel.app/pages/dilaksi-req3-pages-for-removal.html` — confirmed "Delete (410)" pill and `act-del` CSS class present in served HTML.
