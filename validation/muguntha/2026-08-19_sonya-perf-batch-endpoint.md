## Purpose
Validate the Sonya perf-batch fix for muguntha.html's slow Employee Performance page.

## Checks performed
1. `node -e "require(...)"` syntax check on `api/muguntha.js` after edits — loads cleanly.
2. Inline `<script>` blocks in `muguntha.html` syntax-checked via `new Function(...)` — no errors.
3. Local functional testing attempted but blocked — this sandbox's `.env.local`/`.env.vercel.pulled` files carry redacted (empty-string) secrets for `DATABASE_URL` and `SHOPIFY_UK_ADMIN_TOKEN`, so live queries can't run locally. Consistent with how every other Postgres/Shopify-backed feature in this project has always been verified (deploy, then curl production) — not a regression in tooling.
4. First production deploy (maxDuration still 60) — batch endpoint hung, HTTP 000, no response even after 150s client-side wait.
5. Diagnosed via isolation tests:
   - Existing single-month cost endpoint (`?employee=sonya&month=2026-08`, untouched code path via `getCostPayload` refactor) — HTTP 200, 2.7s. Confirms the refactor itself didn't break anything.
   - Direct `salesuk.js` endpoint for a closed month (`2026-07`) — HTTP 200, 1.4s (static snapshot, as expected).
   - Direct `salesuk.js` endpoint for the live month (`2026-08`) — initially timed out at 20s/65s, but a full 280s-timeout test after the maxDuration fix succeeded at 28.5s. Confirms this live-month scan is pre-existing, documented, unmodified behaviour (code comment: "a live full-month Shopify scan takes 30-90s+") — not something introduced by this change.
6. Root cause of the hang: `api/muguntha.js`'s `maxDuration` was 60s in `vercel.json`, but the batch endpoint now runs `salesuk.js`'s live-month scan in-process (previously its own separate function with a 300s budget) — the 60s cap was killing the request before the scan could finish. Fixed by raising it to 300, matching `salesuk.js`'s own existing budget (an established pattern already used by 5 other files in this same `vercel.json`).
7. Redeployed with the fix — user confirmed manually in the live UI that Sonya's tab now loads fast.

## Result
PASS — user-confirmed live after the maxDuration fix.

## Reviewer
Kuberan
