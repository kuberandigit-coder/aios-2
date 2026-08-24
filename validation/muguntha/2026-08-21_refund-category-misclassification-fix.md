## Purpose
Validate the refund-category keyword fixes against real, Kuberan-confirmed examples.

## Checks performed
1. For each of `#LED55484`, `#LED56013`, `#LED55698`, `#LED57394`, fetched the order's real `Refund.note` text live from Shopify UK and ran it through the updated `categorizeReason()` logic (standalone Node reproduction of the function, not guessed).
2. Confirmed no other already-correct row was broken by the change — spot-checked the wider refund set on the live page after deploy.
3. Confirmed the percentage popup recomputes from live `ROWS` on every open (verified in code — no cached/stale percentage state exists).
4. Verified via `grep -o "'scratch','scuff'"` on the deployed page returning a match, confirming the fix shipped to production (not just committed).

## Result
PASS — all 4 examples classify correctly; no regressions found on the wider dataset.

## Reviewer
Kuberan
