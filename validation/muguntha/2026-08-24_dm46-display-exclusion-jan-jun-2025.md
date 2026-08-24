## Purpose
Validate the Jan-Jun 2025 DM-46 display exclusion for Sonya/Sajeepan.

## Checks performed
1. Curled `?action=perf-batch&member=sonya` directly — confirmed the (unused) server-side strip worked in isolation, ruling that path out as broken code before realizing it wasn't wired to the frontend.
2. Curled the actual raw endpoints (`/api/sales25?group=sonya&month=2025-01`, `/api/muguntha?employee=sonya&month=2025-01`) — confirmed they still return DM-tagged rows/`dmProductCost`, as expected (this data must NOT be altered — the strip belongs client-side only).
3. `node -e "new Function(...)"` syntax check on all `muguntha.html` script blocks after each edit.
4. Confirmed July 2025 and all 2026 months are untouched by grepping the exclusion month set.
5. Second follow-up fix (hide DM entirely, not show "£0.00") verified via the same syntax check plus manual code review of `costCell`/`openCostPopup`'s conditional note logic.

## Result
PASS.

## Reviewer
Kuberan
