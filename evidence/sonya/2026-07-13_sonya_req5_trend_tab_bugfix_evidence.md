---
date: 2026-07-13
staff: Sonya
requirement: Requirement 5 — Stop Waste Spend (built by contributor Piranav)
type: evidence
---

# Sonya Req5 — Stop Waste Spend Tab — Structural Bug Fix — Evidence

## Discovery

While handling the Jakshan sync (see
`evidence/jakshan/2026-07-13_jakshan_req1_req2_regression_and_divfix_evidence.md`),
`git fetch` on the `Staff-requirements` clone surfaced a new remote commit:

```
1659bd3 [AIOS] Sonya Req5 — Stop Waste Spend tab + status filter + geo data
  pages/sonya.html | 226 ++++++++++++++++++++++++++++++++++++++++++++++++++++-
```

Per the div-balance validation habit established this session, checked the
file before deploying anything — found it broken:

```
div-balance check: 213 open / 215 close  (2 extra closing divs)
```

## Root cause

Traced with a per-line depth counter (`find_div_imbalance.js`). Found at
line 376, inside the Requirement 3 ("Trend & Segment Dashboard") tab panel:

```html
  <div id="trendShowMore" style="display:none;text-align:center;margin-top:10px">
    <button onclick="tPage++;tRender()" ...>Show Next 300</button>
  </div>
</div><h2>Trend</h2><p>Coming soon — awaiting requirement specification.</p></div></div>
  <div class="tab-panel" id="panel-4" role="tabpanel">
```

Line 376 contains leftover placeholder markup from an old stub version of
the Trend tab (`<h2>Trend</h2><p>Coming soon...</p>`) that was never
deleted when the real Trend table (search/filter/table, lines 322-375) was
built out above it — left behind along with **2 extra stray `</div>`
tags** beyond what was needed to close the `tab-panel` wrapper.

## Fix applied

Replaced the single malformed line with just `</div>` (closing the
`panel-3` tab-panel wrapper cleanly), removing the dead `<h2>`/`<p>` text
and the 2 extra closing tags.

## Validation before deploy

```
find_div_imbalance.js → FINAL DEPTH: 0  (was -2)
node --check <extracted first <script> block> → OK
div-balance check → 213 open / 213 close
```

## Files modified

- `reports/digital-marketing-member-pages/pages/sonya.html` — removed
  leftover Trend-tab stub markup + 2 stray `</div>` tags (Requirement 3
  section, line ~376).

## Deployment evidence

- Production verified: `curl .../pages/sonya.html → 200`, confirmed
  "Stop Waste Spend" text present in response (new Req5 tab renders).
- Repos: `aios-2@f1b2ad5` (also carries the latest `jakshan.html`
  auto-refresh data in the same commit), `Staff-requirements@c1bfae6`.
