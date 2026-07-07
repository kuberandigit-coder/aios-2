# Validation — Kamsi Requirement 4: Duplicate of Dilaksi Requirement 2

**Title:** Validation checklist proving no data refresh happened
**Purpose:** Confirm the Kamsi Req 4 page is an exact, label-only duplicate of Dilaksi Req 2
**Requirement Source:** GPT planning layer instruction, 2026-07-07
**Business Question:** Is the Kamsi Req 4 deliverable safe to hand off as a pure reuse, with zero data risk?
**PostgreSQL Sources Checked:** Not checked for this task because copy-only reuse was requested
**External Sources Checked:** Not checked for this task because copy-only reuse was requested

| Check | Result |
|---|---|
| Dilaksi Requirement 2 source file found | PASS — `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` |
| Exact code/data copied | PASS — programmatic diff confirms CSS block, JS block, and embedded `ROWS` JSON array are byte-identical between source and copy |
| Kamsi Requirement 4 created | PASS — `kamsi-req4-product-priority-guidance.html` (live-site) + `kamsi-requirement-4-product-priority-guidance.html` (archival copy) |
| Only staff name/requirement labels/paths changed | PASS — exactly 6 targeted string replacements (title, tab-nav, eyebrow label, "Requested by", rule-note attribution, footer note); output file is +539 bytes vs. input, matching only the added label text |
| No new data collection performed | PASS — no MCP Shopify/Semrush/GA4/GSC tool calls made during this task |
| No Dilaksi files overwritten | PASS — `git status` shows only new/modified Kamsi files; Dilaksi's `dilaksi-req2-all-products.html` and archival twin untouched |
| Duplicate risk documented | PASS — full-repo search confirmed no prior `kamsi-req4-*` file existed; documented in evidence file |
| AIOS files saved | PASS — prompt, evidence, validation (this file), handover, vercel notes, plus the HTML report itself |
| No deployment performed | PASS — no `vercel deploy` command run for this task |

## Row-count / data-integrity spot check
```
dilaksi rows: 5179 | kamsi rows: 5179
rows identical: True
CSS identical: True
script block identical: True
```

## Column names
Embedded dataset keys unchanged: `t` (title), `st` (status), `c` (collections), `sk` (SKUs), `nv` (variant count), `s` (sales), `u` (units), `d` (demand), `k` (keyword), `o` (organic sessions), `p` (SEO priority), `cond` (matched rule condition) — identical to Dilaksi Req 2.

## Calculations
SEO Priority rule logic (`applyFilter`, `priKey`, `rowHtml` JS functions) is byte-identical — no recalculation, no rule change.

## UI
CSS block byte-identical; layout, toolbar, filters, pagination, summary cards all unchanged.

**Validation result:** PASS
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Completed — not deployed
**Known limitations:** carried over from evidence file (tab label deviates from the literal Step-2 example text to avoid duplicating Req 3's title; underlying data is Dilaksi's ledsone.co.uk catalog, unchanged)
**Next step:** Kuberan review; deployment approval if desired
**PASS / FAIL:** PASS
