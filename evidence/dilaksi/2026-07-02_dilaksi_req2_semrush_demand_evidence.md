# Evidence — Req 2 Demand (searches/mo) via Semrush

**Title:** Semrush demand data for Dilaksi Requirement 2 all-products page
**Purpose:** Fill Demand (searches/mo) with verified Semrush volumes, no invented values.
**Date:** 2026-07-02 · **Requirement number:** 2
**Requirement source:** Google Sheet — Product Priority Guidance (Last 30 Days)
**Team member:** Dilaksi · **Team:** SEO
**Business question:** Which products/categories should Dilaksi prioritise for SEO?

## Existing asset search
`**/*semrush*` across all AIOS folders → none. Prior req2 evidence notes demand was "pending". Duplicate-risk GREEN.

## Semrush source checked
- Connector: claude.ai Semrush MCP, toolkit `keyword_research`, report **`phrase_these`** (batch, 10 API units/line).
- **Database: `uk`** — matches store market ledsone.co.uk (assumption documented: no other market specified in source-map).
- Pulled: **2026-07-02**. 2 batch calls (35 + 4 keywords), export columns Ph/Nq/Cp/Kd.

## Keyword→row mapping (keywords checked, volumes = monthly searches, UK)

**Collection head terms (HIGH confidence):** pendant lights 6,600 · wall lights 40,500 · spider light 1,000 · plug in lighting 170 · table lamps 18,100.

**Top 30 products by sales (keyword derived from cleaned product title; matching priority rule #2):**

| Product ID | Keyword used | Vol/mo | Conf | Note |
|---|---|---|---|---|
| 15086824259970 | metal pendant ceiling lights | 20 | MEDIUM | |
| 15071739019650 | industrial wall light | 480 | LOW | fallback — "rustic industrial wall light" = 0 |
| 4417272086624 | adjustable pendant light | 260 | MEDIUM | |
| 15260815720834 | nautical wall light | 40 | MEDIUM | |
| 7105746796705 | pool table lights | 1,000 | HIGH | |
| 6898632065185 | plug in pendant light | 1,300 | HIGH | |
| 15023091188098 | single pendant light | 170 | MEDIUM | |
| 7982911619322 | pendant lamp holder | 210 | MEDIUM | |
| 8011075125498 | crow table lamp | 20 | HIGH | |
| 14872946311554 | swan neck wall light | 210 | HIGH | |
| 7053693649057 | spider ceiling light | 320 | MEDIUM | |
| 6852374102177 | hemp rope pendant light | 20 | MEDIUM | |
| 14881058324866 | wall spotlight | 590 | LOW | fallback — "wall spotlight gu10"/"gu10 wall spotlight" = no data/0 |
| 7630664532218 | copper wall light | 260 | MEDIUM | |
| 4552643903584 | steampunk lamp | 480 | LOW | fallback — "steampunk pipe light" = 0 |
| 15260060582274 | steampunk ceiling light | 140 | MEDIUM | |
| 14879664472450 | adjustable ceiling spotlight | 10 | MEDIUM | |
| 15270960234882 | octopus pendant light | 20 | MEDIUM | |
| 14907263746434 | easy fit pendant light | 110 | MEDIUM | |
| 14934429958530 | industrial pendant light | 390 | MEDIUM | |
| 7819052286202 | spider lamp | 140 | MEDIUM | |
| 15322580779394 | black and gold pendant light | 260 | MEDIUM | |
| 6024708292769 | e27 lamp holder pendant | 10 | MEDIUM | |
| 15097952764290 | semi flush mount ceiling light | 1,300 | HIGH | |
| 6024708718753 | fabric cable pendant light | 20 | MEDIUM | |
| 14929097884034 | metal shade pendant light | 90 | MEDIUM | |
| 7651373547770 | plug in ceiling light | 590 | MEDIUM | |
| 7982927741178 | copper pendant light | 880 | MEDIUM | |
| 7985931354362 | e27 pendant light | 90 | MEDIUM | |
| 8073532997882 | rope pendant light | 260 | MEDIUM | |

## HTML update
- `pages/dilaksi-req2-all-products.html` regenerated: purple demand badge (hover = keyword) on the 30 mapped products; collection headers show head-term demand; header chip + footer note "Demand data source: Semrush keyword monthly search volume. Keyword mapping documented in AIOS evidence."
- Synced copy: `reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html`.
- Requirement 1 page and all other member pages untouched. NOT deployed (approval pending).

**Files created/modified:** the 2 HTML files above + 7 AIOS files (this set)
**Evidence path:** this file · **Validation result:** PASS (see validation file)
**Owner/reviewer:** Kuberan (GPT validation layer) · **Status:** DONE locally, deploy pending
**Known limits:** 30 of 1,231 products keyword-mapped (top sellers); remainder pending batch approval (~1,200 more Semrush lines ≈ 12,000 API units); volumes are UK national head-term estimates, not product-exact.
**Next step:** approve deploy; decide on full-catalog keyword batch.
**PASS/FAIL rule:** PASS — all displayed demand values come from executed Semrush reports; mapping fully documented; zero invented numbers.
