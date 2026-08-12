# Evidence — URL Hash Sync: Browser Refresh Stays on the Same Tab, All 13 Dashboard Pages (2026-08-12)

**Purpose:** Record of a system-wide UX fix and two same-day follow-up bug fixes it surfaced.

## Problem
Pressing browser refresh (F5 / reload arrow — not the page's own in-app "Refresh (live)" button) always reset every dashboard page back to its default tab (usually Requirement 1 / the first tab), silently losing the user's place. E.g. refreshing while viewing Jefri's Requirement 5 would drop back to Requirement 1 with no warning.

## Fix (`0d32b19`)
Every tab-switch function across all 13 dashboard pages now writes the active tab to the URL as a hash on switch, and reads that hash back on page load to restore the correct tab — including non-default tabs, which now correctly trigger their normal click-handler/loader instead of being silently skipped. Page-specific function names touched: `jefri.html` (`showReqTab`), `thasitha.html` (`switchTab`), `muguntha.html` (`selectMember`), `kamsi.html`/`dilaksi.html`/`theekshy.html`/`thivajini.html`/`hetheesha.html`/`jakshan.html`/`sonya.html` (`showTab`), `mahima.html` (`showTab`, with explicit handling for non-contiguous tab numbers), `sukirtha.html` (`showReqTab`), `sajeepan.html` (`switchReqTab`). Verified live byte-identical to local on all 13 pages after deploy.

## Follow-up bug 1 — sidebar highlight not following restored tab (`6815488`)
On `jefri.html`/`sukirtha.html`, the restored tab's content loaded correctly but its sidebar nav item wasn't visually marked active — the sidebar still showed the default tab as selected. Fixed same day.

## Follow-up bug 2 — self-clobbering hash on jefri.html (`a1095d1`)
A subtler bug specific to `jefri.html`: its unconditional default-tab call (`showReqTab('req1')`, which fires on every page load regardless of the URL hash) itself writes `#req1` to the URL as a side effect of running. On a browser refresh landing on e.g. `#req5`, this default call would run and silently overwrite the real `#req5` hash with `#req1` — before the restore logic further down the page ever got a chance to read the original value. Fixed by capturing `location.hash` into `JEFRI_INITIAL_HASH` at the very top of the script, before the default-tab call runs. `jefri.html` was the only page affected — the only one with both an unconditional default-tab call AND hash-writing inside that same function.

## Files touched
- `reports/digital-marketing-member-pages/pages/{jefri,thasitha,muguntha,kamsi,dilaksi,theekshy,thivajini,hetheesha,jakshan,sonya,mahima,sukirtha,sajeepan}.html` (all 13)

## Deployment
Deployed to production, verified live byte-identical to local on all 13 pages.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
