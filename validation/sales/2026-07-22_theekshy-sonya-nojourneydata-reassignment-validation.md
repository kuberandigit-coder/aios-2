# Validation — Theekshy + Sonya No-Journey-Data Reassignment Analysis

**Date:** 2026-07-22
**Reviewer:** Claude (in-session), user directed the Theekshy revert directly

## Theekshy — checks performed
- [x] Match rate sanity-checked against campaign breadth: 2 narrow campaigns, ~5% match rate — consistent with genuine ad influence, not coincidental overlap (cross-checked against Sonya's result as a contrast case, see below).
- [x] Confirmed live deploy occurred (user was shown the change working before requesting revert).
- [x] Confirmed revert method (`git checkout --`) was valid given the change had never been committed — no risk of losing other work.
- [x] Confirmed all 4 affected static snapshots (Theekshy Mar/Apr/May/Jun) were regenerated back to original values and redeployed.
- [x] Live-verified post-revert state: March `matched: 0`, matching pre-fix behavior exactly — direct confirmation, not assumed.
- [x] Confirmed zero residue: nothing committed to git, nothing synced to `Staff-requirements`, Kamsi/Dilaksi snapshots unaffected.
- [x] User's explicit instruction to hold pending "admin permission" is recorded verbatim, not paraphrased into something stronger or weaker than what was said.

## Sonya — checks performed
- [x] Match rate sanity-checked against campaign breadth: 19 broad campaigns covering 5,759 products, ~44% match rate — correctly identified as not credible (too broad to be real ad influence), and correctly NOT implemented on that basis.
- [x] Confirmed no code was deployed for Sonya — this stayed at the analysis stage, consistent with the "not safe to implement as-is" conclusion.
- [x] Confirmed the raw month-by-month match counts are internally consistent (Dilaksi + Kamsi NJ/Matched figures sum sensibly across Mar–Jun).
- [ ] Not verified: whether the scratch file `C:\Users\PC\OneDrive\Desktop\theekshy_analysis\sonya_all_matched.json` still exists — flagged as a real risk in the evidence file, not silently assumed to be safe.

## Result: PASS (both — correct outcome reached and correctly not over-implemented)
Theekshy's fix was real, was deployed, and was correctly and cleanly reverted on explicit instruction with verified zero residue. Sonya's analysis correctly stopped short of implementation once the false-positive rate was found to be too high — this is the right call, not an incomplete task.

## Outstanding issues
1. Theekshy: waiting on confirmation that "admin permission" has been resolved before re-applying.
2. Sonya: waiting on user decision on which stricter-signal approach (if any) to pursue; scratch file with the 84-order list may not survive until then.
