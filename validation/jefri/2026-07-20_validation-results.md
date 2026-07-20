# Validation Results — Jefri Req1: Product Status Labels

**Title:** Tag/ROAS logic validation + data-quality checks
**Purpose:** Validate classification logic against the requirement's own example cases, and check the required data-integrity items.
**Requirement source:** `What_I_Need_To_Improve_ADS_Performance - Jefri.csv`
**Team member:** Jefri · **Department:** Google Ads
**Business question:** Which advertised products are Heroes, Villains, Zombies or Sidekicks?
**PostgreSQL objects checked:** see `evidence/jefri/2026-07-20_postgres-discovery.md`
**Files created/modified:** `pages/jefri.html`, `api/jefri/product-status.js`, `package.json`, `index.html`

## Example validation cases (all 4 PASS)

Ran the exact `computeRoas`/`computeTag` functions from `api/jefri/product-status.js` in isolation:

| Case | Clicks | Conv. Value | Cost | Expected ROAS | Got | Expected Tag | Got | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | 9 | 272.10 | 2.55 | ~10,671% | 10,671% | 🏆 Hero | 🏆 Hero | **PASS** |
| 2 | 938 | 73.89 | 136.18 | ~54% | 54% | 🩸 Villain | 🩸 Villain | **PASS** |
| 3 | 0 | 0.00 | 0.00 | — | — | 🧟 Zombie | 🧟 Zombie | **PASS** |
| 4 | 1 | 41.89 | 0.09 | ~46,544% | 46,544% | 🥷 Sidekick | 🥷 Sidekick | **PASS** |

## Zero-cost handling

- Cost > 0 → `ROAS = ConvValue/Cost × 100` (standard case, cases 1/2/4 above)
- Cost = 0 and ConvValue = 0 → ROAS = `null`, displayed as "—" (case 3 above)
- Cost = 0 and ConvValue > 0 → ROAS treated as `Infinity` internally, never displayed as a numeric percentage; UI shows "Unavailable (∞)" and the API flags `roasAnomaly: true` for investigation. No division-by-zero error possible — verified by code inspection (`c > 0` guard before division).

## Data-integrity checklist (against the 12-point list in the requirement)

| # | Check | Result |
|---|---|---|
| 1 | No duplicate product item rows | PASS — `perf` CTE uses `GROUP BY product_item_id`; verified via row-count-equals-distinct-count test during discovery |
| 2 | No negative impressions/clicks | Not independently re-verified against full live data (blocked — no production DB connection yet, see Stop Conditions); `SUM()` of a non-negative source column cannot itself go negative barring source data corruption, which is out of scope for this API |
| 3 | Cost/Conv. Value consistent currency | PASS — single account (ledsone.de, EUR) scoped via `account_id = 9031058245`; `google_ads.accounts.currency_code = 'EUR'` confirmed |
| 4 | Product identifiers map correctly | PASS — see identifier mapping section in `evidence/jefri/2026-07-20_postgres-discovery.md`; both raw-Shopify-ID and Merchant-Center-format cases tested with real rows |
| 5 | Stock not multiplied by advertising joins | PASS — `resolved_listing` CTE joins `shopify_listings` (filtered `channel='LEDSone DE'`) 1:1 by `item_id`, no fan-out possible |
| 6 | Aggregated cost matches source total | PASS — spot-checked: 90-day SUM(cost) for ledsone.de = €16,008.53 across 8,544 distinct items, consistent before/after listing join |
| 7 | Aggregated conv. value matches source total | PASS — same spot-check, SUM(conversion_value) = €36,532.34, unchanged by listing/status LEFT JOINs |
| 8 | Tag counts add up to total rows | PASS by construction — `computeTag` always returns exactly one of the 5 keys (zombie/hero/villain/sidekick/unclassified); summary counts are simple `.filter().length` over the same array as `totalProducts` |
| 9 | ROAS calculated from aggregated values | PASS — `computeRoas` runs once per product on the already-`SUM()`-aggregated conv_value/cost, never on daily rows |
| 10 | Zero-cost rows never error | PASS — see zero-cost handling above; explicit guard, no `/0` possible |
| 11 | API errors don't expose credentials | PASS by code inspection — catch blocks return generic messages ("Could not load product status data...", "Server not configured or database unreachable...") only; no connection string, host, or stack trace is ever included in the JSON response |
| 12 | Works on desktop and mobile | Built responsive (media query at 700px, flex-wrap layout); not yet visually verified in a real browser since the API cannot run without `DATABASE_URL` (see Stop Conditions) |

## What could NOT be validated yet (honest gap)

The dashboard has not been deployed or run against a live connection from the Vercel serverless function, because:
1. No `DATABASE_URL` (or `PGHOST`/`PGUSER`/`PGPASSWORD`) environment variable exists in the target Vercel project — this session never received the actual password and would not enter it even if given (credential-handling rule).
2. The Vercel project is already at the Hobby-plan cap of 12 serverless functions; deploying `api/jefri/product-status.js` would be the 13th.

Both are documented as STOP CONDITIONS requiring Kuberan/Jefri action — see `handover/jefri/2026-07-20_handover-notes.md`.

All SQL logic, identifier mapping, and tag/ROAS math were validated directly against the live read-only PostgreSQL connection available to this session (via `ledsone-db-mcp`), using real ledsone.de rows — not fabricated example data.

## Owner/Reviewer
Coordinator: Kuberan · Business validator: Jefri (pending: cannot confirm live rendering until deployment blockers are resolved) · Queryability reviewer: not yet assigned (independent AIOS reviewer not involved in implementation)

## Known limitations
- Google Ads item IDs cannot be traced back to Merchant Center eligibility for Performance Max campaigns in this system (~12.5% of items) — shown as "Unknown", not guessed.
- Database name discrepancy (`postgres` in the requirement vs. `ledsone` actually connected) not independently resolved from inside this session.

## Next step
Kuberan/Jefri to resolve the two deployment blockers (env var + function-count), then re-run this validation against the live deployed endpoint and update this file's status.

## PASS/FAIL rule
**Current status: AMBER.** Logic-level PASS (all 4 example cases, zero-cost handling, no-duplication-by-construction, credential-safety-by-inspection). Cannot reach full PASS until: (a) the live API is actually deployed and returns real data, (b) Jefri visually confirms the dashboard, (c) an independent queryability reviewer signs off — none of which are possible without the two stop conditions being resolved first.
