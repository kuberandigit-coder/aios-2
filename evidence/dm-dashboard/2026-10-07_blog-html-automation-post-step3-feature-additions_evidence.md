# Evidence — Blog HTML Automation, Post-Step 3 Feature Additions

**Date:** 2026-10-07 (13:38–17:59), documented 2026-10-08 as a missed-update catch-up
**Developer:** Kuberan
**Preceded by:** `2026-10-07_blog-html-automation-step3-implementation` (closure said "not merged,
not deployed" at 11:10am — that status is now superseded, see Correction below).

## Correction to the Step 3 closure record

The Step 3 closure doc (`closure/dm-dashboard/2026-10-07_blog-html-automation-step3_closure.md`)
states commits `f8e8984`/`1aa6001` were "on `dev-work`, pushed, not merged to `main`, not
deployed." Verified against the actual repo on 2026-10-08:

```
git merge-base --is-ancestor 1aa6001 origin/main   -> YES, is an ancestor
```

`1aa6001` and every commit listed below **are** present in `origin/main` as of its current tip
(`98a2057`, 2026-10-07 17:59:16). They were merged in 27 separate "Merge branch 'dev-work' via
Dev Tools" merges between 13:38 and 17:59 on 2026-10-07, using the same Dev Tools merge-to-main
flow documented elsewhere in AIOS. The CI/CD pipeline set up that same morning
(`docs/CI-CD-SETUP.md`) auto-deploys on every merge to `main` — so these merges very likely
triggered 27 real auto-deploys, but **this catch-up does not independently re-verify the VPS
process restarted for each one** (no server check was run this session); recorded as "merged to
main" on git evidence, not re-confirmed as deployed. See the closure doc's addendum note.

## Commits (chronological, non-merge, all confirmed present in `origin/main`)

| Commit | Time | Message |
|---|---|---|
| 2b71c62 | 13:38 | feat: add delete button for generations in History |
| 65fd634 | 13:47 | feat: support selecting multiple keyword suggestions |
| 8e4e395 | 13:48 | fix: show actual Content Gap and AEO/GEO items, not just the AVAILABLE pill |
| dc1d0c0 | 13:51 | perf: parallelize AI section calls, cut generation time |
| da12e64 | 14:20 | fix: match reference blog's structure/order more closely |
| 98e23ba | 14:28 | feat: show a progress bar + elapsed time while generating |
| abb0e75 | 14:34 | fix: drop the generated block's own 760px width cap |
| 332432d | 14:42 | fix: stop generic title words from polluting keyword suggestions |
| f7580ef | 14:51 | feat: support Collection+Products and Products-only topic modes |
| c72ea67 | 14:55 | fix: add the Dev: Kuberan badge, matching other dev task pages |
| 7dbb4a7 | 15:01 | feat: weave internal links inline into paragraphs, not a raw link list |
| 0b1e17d | 15:04 | feat: add a "quick rule of thumb" callout box |
| 1971834 | 15:06 | feat: redesign shop cards with a View Product button, drop table from default |
| 9d9d386 | 15:08 | fix: image-count fix removes the whole product card, not just its `<img>` |
| 5a84763 | 15:11 | feat: tag every top-level block for the visual editor, reinstate comparison table (default-on, removable) |
| a710012 | 15:12 | feat: give each inline internal link a unique `data-link-id` |
| 74ba354 | 15:14 | feat: visual Customize editor — click to remove/recolor blocks in preview, auto-saves to code |
| b20100f | 15:20 | fix: match reference blog's real HTML structure precisely |
| ec38106 | 15:39 | fix: stop literal `"<a href=...>"` text, break up giant paragraphs, drop Compare at a Glance, fix product card sizing |
| f523878 | 15:54 | fix: generation taking minutes/appearing stuck — same-day regression from the paragraph-break fix |
| bd0e20b | 16:02 | fix: "Failed to fetch" on the Word count QA fix |
| df458b8 | 16:12 | feat: clean anchor text (strip SKU suffix), manual cursor-select text editing in Customize |
| 23926ed | 16:37 | fix: use short `product_type` as anchor text, not the full product title |
| 8f894a9 | 16:46 | fix: remove title-derived keyword, GSC-only suggestions |
| 2e378e3 | 16:54 | fix: exclude 0-click GSC queries from keyword suggestions |
| a33d450 | 16:59 | feat: also gather keyword suggestions from real Google Keyword Planner data, when it exists |
| 0f2330a | 17:07 | feat: real Google Ads paid-search keywords from the business database |
| 40684c9 | 17:19 | feat: add a Fix button for "FAQ count (6-8)" |
| 8330437 | 17:58 | fix: color picker got deselected after one pick, cut AI timeouts, background the last blocking meta call |

A separate, unrelated 1-line housekeeping commit from the same window
(`625d628`, 13:39: "remove temporary CI/CD live-deploy test marker from Branches heading") is a
cleanup of the CI/CD setup work already recorded in
`evidence/dm-dashboard/2026-10-07_cicd-github-actions-implementation_evidence.md` — noted here for
completeness, no new doc needed for it.

## New data sources introduced (relevant to source-map / capability)

- **Google Keyword Planner data** (`a33d450`) — gathered as an additional keyword-suggestion input
  "when it exists" (graceful fallback implied, not asserted as always-available — exact fallback
  behaviour not independently re-verified this session, see Validation doc).
- **Google Ads paid-search keywords from the business database** (`0f2330a`) — a second additional
  keyword-suggestion input, sourced from the existing business database rather than a live Ads API
  call per the commit message's own wording ("from the business database").

Both feed the same keyword-suggestion feature already covered by the Step 3 architecture's GSC
data path; they extend it rather than replace it (GSC-only commits `8f894a9`/`2e378e3` immediately
precede them in the same session, suggesting iterative refinement of the same feature).

## Explicitly not verified this catch-up session

- No browser access was available (same limitation as Step 3's own closure) — none of this UI/UX
  work (visual Customize editor, progress bar, color picker, delete button) was click-tested.
- No server-side (`journalctl`) re-check of whether each merge actually redeployed successfully.
- No independent test of the Google Keyword Planner / Google Ads data paths beyond reading the
  commit diffs' stated intent — no live API/database response was inspected this session.
