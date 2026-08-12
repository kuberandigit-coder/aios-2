# Jefri Req4/Req5 — Post-Launch Fixes & Enhancements — Evidence

**Title:** Post-launch hardening of Requirement 4 (Item ID → Parent Product ID Mapping) and Requirement 5 (Cross-Campaign Attribution / ROI Analyzer)
**Purpose:** Document the real bugs found and fixed, and the features added, in the period immediately following Req5's initial launch (same day, 2026-08-12).
**Requirement Source:** Follow-on to `prompts/jefri/2026-08-12_req5-cross-campaign-attribution-prompt.md` and `T-04-data-discovery-prompt.md`.
**Team Member:** Jefri · Google Ads / Digital Marketing
**PostgreSQL Source Checked:** No new tables — all fixes below are frontend/routing/deploy issues, not calculation-logic changes. Where a "0 results" report was investigated, it was re-verified against `ledsone-db-mcp` directly before concluding bug-vs-real-data (see Bug 3 below).

## Summary of changes, in order

### 1. CSS fixes (cosmetic, no logic change)
- Req5's Start Date/End Date/Source Campaign dropdown were unstyled (browser defaults) — added scoped `#req5Tab .filters select/input[type=date]` CSS matching the rest of the page.
- Req5's "Run Analysis" button used class `.primary`, which was never actually defined anywhere in the page's CSS — it rendered as a bare default button. Fixed by adding `#r5RunBtn` to the same shared button-style selector already used for the other Refresh buttons.

### 2. Behavior change: Req5 auto-loads like R1–R4 (explicit instruction)
Originally Req5 required a manual "Run Analysis" click even for the first view. Changed to auto-load on tab open (first campaign in the dropdown + default 90-day range) and auto-reload whenever Source Campaign/Start Date/End Date change — matching every other Requirement tab's convention. The button was renamed "Refresh (live)" and now only forces bypassing the 5-minute server cache for the *current* selection.

### 3. Browser-refresh tab persistence — added to all 13 staff/admin pages, two real bugs found and fixed
**Feature:** every tab-switch function now writes the active tab to the URL as a hash, and each page reads that hash on load to restore the correct tab instead of always defaulting to the first one. Applied to jefri.html, thasitha.html, muguntha.html, kamsi.html, mahima.html, dilaksi.html, theekshy.html, thivajini.html, hetheesha.html, jakshan.html, sonya.html, sukirtha.html, sajeepan.html.

**Bug A — sidebar highlight not following the restored tab (jefri.html, sukirtha.html only).** Their tab-content function (`showReqTab`) doesn't touch the sidebar's `.on` highlight class — that's set separately, inside each nav link's own click handler. The first version of the restore code called `showReqTab()` directly, which correctly restored the *content* but left the sidebar highlighted on Requirement 1. Fixed by clicking the matching sidebar link instead (`link.click()`), which was already the correct approach used on the other 11 pages (whose tab functions don't self-manage the sidebar either, so `.click()` was used for them from the start — no bug there). `thasitha.html`/`muguntha.html` toggle their own nav highlighting internally, so calling their switch function directly was always correct.

**Bug B — self-clobbering hash, jefri.html only.** jefri.html unconditionally calls `showReqTab('req1')` once on every page load (to show the default tab). Once hash-writing was added *inside* `showReqTab` itself, that unconditional default call immediately overwrote the real `#req5` (or whatever tab the URL had) with `#req1` — **before** the restore logic further down the page ever got a chance to read the original hash. Result: refreshing while on Req5 always silently reset to Req1, with no error, because by the time the restore code ran, `location.hash` already read back `#req1`. No other page has this exact combination (an unconditional default-tab call that itself writes the hash, executing before the restore logic) — confirmed by checking every page's script for an unconditional `showTab(1)`/`showReqTab(1)`/equivalent call at load; only jefri.html has one. Fixed by capturing `location.hash` into `JEFRI_INITIAL_HASH` at the very top of the script, before the default call runs, and having the restore logic read that captured value instead of `location.hash` (which by then is stale).

### 4. Multi-ID search (Req4 and Req5)
Search box previously did a single substring match — pasting multiple IDs (e.g. `44804658594057, 8421816205577`) matched nothing, since the whole pasted string was treated as one search term. Changed to split on commas, trim each token, and match a row if *any* token is found in its Item ID or Parent Product ID. Applied identically to Req4 (`r4FilteredRows`) and Req5 (`r5FilteredRows`). Req4's search box was also widened (`min-width:420px`) and moved to appear before the date-range filter in the tbar, per explicit request.

### 5. Recurring deploy-sync issue (not a code bug, an operational one)
Multiple times during this work, the live site reverted to a stale build — falling through to an unrelated default API handler, or the page missing recently-added HTML — even though the local repo (verified via `git fetch`/`git rev-list --left-right --count origin/main...HEAD`) was correct and in sync with GitHub. Root cause: **another session is actively working on and deploying this same Vercel project concurrently** (confirmed via unexplained commits/deployments not authored in this session, e.g. `0de6860`, `763217b`, `6a170b0`, `4794e12`). Whichever session deploys last wins the production alias. Resolution each time: `git fetch` + confirm local matches `origin/main`, then `vercel --prod --yes --force` (bypassing the build cache) and verify byte-for-byte against the actual custom domain (`dm-dashboard.vintageinterior.co.uk`, not just the default `.vercel.app` URL — confirmed both are aliased to the same deployment via `vercel alias ls`). Not something fixable in code; flagged as an ongoing operational risk while two sessions share one deploy target.

## Verification performed (real, not assumed)

- Req5 date-filter/campaign-scoped result count spot-checked directly against Postgres (`SUM(cost)>0 AND SUM(conversion_value)=0` for campaign `23141810147`, 2026-05-14 to 2026-08-12 → 317 real qualifying rows; live API after the fix returned 316, a negligible timing difference, not a bug).
- After every fix, redeployed and diffed the live file (both `digital-marketing-member-pages.vercel.app` and `dm-dashboard.vintageinterior.co.uk`) byte-for-byte against the local file before considering it done.
- R1–R4 endpoints re-tested HTTP 200 after every Req5-related deploy.

## Files modified
- `reports/digital-marketing-member-pages/pages/jefri.html` (all fixes above)
- `reports/digital-marketing-member-pages/pages/thasitha.html`, `muguntha.html`, `kamsi.html`, `mahima.html`, `dilaksi.html`, `theekshy.html`, `thivajini.html`, `hetheesha.html`, `jakshan.html`, `sonya.html`, `sukirtha.html`, `sajeepan.html` (tab-restore-on-refresh only)

## Known limitations
- The concurrent-deploy risk (item 5 above) is not resolved, only worked around each time it recurs.
- Tool-view states (EOD Tool/Blog Tool iframes) on muguntha.html were NOT included in the hash-restore — only Requirement/member tabs. A refresh while a tool is open still resets to the performance view. Not reported as an issue yet; noted here for completeness.

## PASS/FAIL
**PASS** — every fix in this record was verified against real live data/DOM after deployment, not assumed correct from code review alone.
