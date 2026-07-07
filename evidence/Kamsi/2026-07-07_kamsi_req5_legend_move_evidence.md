# Evidence — Kamsi Req5: Moved "Evidence Note" Legend to Bottom

**Title:** Moved Req5's `.legend` block (Evidence note / How Action Needed is decided) from above the product table to the very bottom of the panel, after the `.foot` section
**Purpose:** User request — legend was sitting above the table; wanted it at the bottom
**Requirement Source:** User instruction, 2026-07-07
**Team Member:** Kamsi · **Reviewer:** Kuberan

## What changed
Reordered Req5's panel layout from:
```
pager -> legend (Evidence note) -> rowsContainer5 (product table) -> foot (Data source)
```
to:
```
pager -> rowsContainer5 (product table) -> foot (Data source) -> legend (Evidence note)
```
No content was changed — the legend block's text is byte-identical, only its position moved.

## Verification performed
- Div balance: 163 open / 163 close (unchanged, pure reorder)
- Confirmed legend now appears after `.foot` in document order
- `node --check` syntax validation: passed, exit 0
- Live deployment fetch confirmed the new order in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-07_kamsi_before_req5_legend_move_backup.html` — safety backup

## Deployment
Deployed to Vercel production and verified live: HTTP 200, legend confirmed at the bottom, all 5 tabs intact.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live
**Known Limitations:** None
**Next Steps:** none
**PASS / FAIL:** PASS
