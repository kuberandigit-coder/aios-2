## Purpose
Validate Jefri's cost-breakdown popup.

## Checks performed
1. `node -e "new Function(...)"` syntax check on all script blocks.
2. Live curl of `/api/sales25?staff=jeffri-ads&month=2025-03` and `/api/muguntha?employee=jefri&month=2025-03` — confirmed `discounts: 742.57, refunds: 520.27` are real, and `dmProductCost: 0` (correct, no DM concept on DE).
3. Confirmed no Transaction Fee or Subscription Fee row renders for Jefri, with the explanatory note present instead.

## Result
PASS.

## Reviewer
Kuberan
