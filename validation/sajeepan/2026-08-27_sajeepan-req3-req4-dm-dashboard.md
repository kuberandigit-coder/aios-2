## Purpose
Validate Sajeepan Requirement 3 and Requirement 4, ported into `dm-dashboard`, against the old `pages/sajeepan.html` panels 3 and 4.

## Checks performed
1. Read old panel HTML (lines 792-962 for Req3, 965-1379 for Req4) and every referenced JS function (`r3Render*`, `r3GetBand`, `r3ExportCSV`, `r4Render*`, `r4OpenDrawer`, `r4SaveTracker`, `r4LoadBeforeAfter`) in full before writing any new code.
2. Cross-checked the backend query logic in old `api/members-api.js` (`handleSajeepanReq3`, `handleSajeepanReq4`, `handleSajeepanTrackerSave`, `handleSajeepanTrackerDetail`) line-by-line against the new Python endpoints — same thresholds (Level1 conv=0 & cost≥£2; Level2 cv>0 & roas<20%; Level3 cv=0 & imp≥500 & clicks≤3), same before/after window math (start_date ± N days).
3. Verified `google_ads.merchant_products` is genuinely unusable for the two duplicate-detection sub-features (empty after `feed_label` scoping to Sajeepan's SJ prefixes) rather than assuming from a prior session — confirmed via direct query before deciding to mark them "Not available" instead of fabricating results.
4. Found and fixed a real discrepancy versus the old code: `R3_OOS_PG=50` / `R3_PG=25` in the old JS, which I'd initially reversed in the new port — corrected before sign-off.
5. `npx vite build` clean after both requirements.

## Result
PASS — logic, thresholds, and UI structure match the old page; the one page-size mismatch found during review was fixed before completion.

## Outstanding
None for Req3/4. Req5 out of scope per explicit user instruction (needs SerpAPI key).

## Reviewer
Kuberan
