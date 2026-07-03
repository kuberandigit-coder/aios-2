# Evidence — Dilaksi Req 3: GSC Impressions Filled + Index Card Link

- **Title:** GSC impressions live on Req 3 page + R3 added to Dilaksi card on index.html
- **Purpose:** Record the GSC data fill and hub navigation update.
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Team:** SEO · **Requirement number:** 3 · **Owner/reviewer:** Kuberan
- **Business question:** Complete the Requirement 3 report columns and make the page reachable from the hub.

## 1. GSC Impressions (connection completed by owner, then queried)
- Connector: GSC Search Analytics API, service account (Restricted), property `sc-domain:ledsone.co.uk` — first successful query 2026-07-03.
- Window: last 12 months, exact-page filter per URL. Results (`reports/dilaksi/data/2026-07-03_req3-gsc-impressions-12m.csv`):
  - /collections/wall-light → **148,429 impressions / 87 clicks**
  - the four dead URLs → 0 impressions / 0 clicks
- Page updated (both copies): GSC Impressions column filled (0 blank cells), connector chip + methodology footnote added. Only Recommended Action and Referring Backlinks (Semrush pending) remain open.

## 2. Index card (like Req 1 / Req 2)
- `index.html` Dilaksi expander card: added `R3 — Pages for Removal — last 12 months` pagebtn (same design as R1/R2 buttons), description updated "2 pages" → "3 pages available".

## Deployments (both verified live)
- GSC data fill: `dpl_6TSEbaN2CSAQQ9VMJtFnbv2KSGoP` — 148,429 visible, footnote present, 0 blank impression cells.
- Index card: `dpl_354jB9QCuQLH4K8QoFSX2msUUBsF` — index 200 with R3 link + "3 pages available"; req3 page 200; R1/R2 unaffected.

- **Files created:** GSC results CSV, this file · **Files modified:** req3 page (both copies), index.html, closure/docs updates
- **Evidence path:** this file · **Validation result:** PASS (live checks above) · **Status:** complete
- **Known limits:** Referring Backlinks still pending Semrush; Recommended Action deferred by requirement
- **Next step:** Semrush backlink data → final column
- **PASS/FAIL rule:** PASS if GSC values are real API data and the hub link works live. **PASS**
