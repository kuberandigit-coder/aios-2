# Evidence — salesuk.html: 2025 January Backfill

**Title:** Jan 2025 backfill — build evidence
**Purpose:** Record what was built and the resulting numbers.

## What was built
- New `api/sales25.js` — a self-contained clone of `api/salesuk.js`'s architecture (Shopify Admin GraphQL order fetch, `customerJourneySummary`-based session classification, mutually-exclusive `GROUPS` array checked in priority order, virtual "Not Assigned" 11th group). Reuses the **exact same confirmed campaign/UTM ownership rules** already established across the 2026 buildout (DM-Ad, Meta, Sonya, Sajeepan, Sukirtha, Organic, CPPC, Thishoban, Theekshy, Thanishtika) — not re-derived or guessed for 2025.
- One deliberate rule NOT ported: Meta's 2026-05/06-only blanket "every Social order → Meta" rule was confirmed for those two specific 2026 months only, so it does not apply to 2025 (documented in code comment).
- `SUPPORTED_MONTHS = ['2025-01']` in the new file — no live month, all closed history.
- `scripts/bulk-sales25-refresh.js` — clone of `bulk-salesuk-refresh.js`, pointed at `/api/sales25`.
- `vercel.json` — added `api/sales25.js` to the functions block (`maxDuration: 300`). Confirmed only 4 total serverless functions exist (`sales.js`, `requirement.js`, `salesuk.js`, `sales25.js`) — well under Vercel's Hobby 12-function limit.
- `pages/salesuk.html` — added a "Jan 2025" month tab; `apiEndpointFor(month)` routes `2025-*` months to `/api/sales25`, everything else to `/api/salesuk` (same page, same UI, just a different backend per era).

## Results (January 2025, generated via bulk-sales25-refresh.js, live Shopify data)
| Group | Orders | Net Sales |
|---|---|---|
| DM-Ad | 698 | £13,354.38 |
| Meta | 3 | £59.90 |
| Sonya | 260 | £6,144.02 |
| Sajeepan | 90 | £2,140.88 |
| Sukirtha | 5 | £261.71 |
| Organic | 448 | £15,561.89 |
| CPPC | 0 | £0.00 |
| Thishoban | 0 | £0.00 |
| Theekshy | 0 | £0.00 |
| Thanishtika | 0 | £0.00 |
| **Not Assigned** | **231** | **£7,306.05** |
| **Total** | **1,735** | **£44,828.83** |

Zero orders (CPPC/Thishoban/Theekshy/Thanishtika) is expected — those campaigns didn't exist yet in January 2025 (confirmed first appearances in 2026 data per each group's own scope notes in salesuk.js).

## Not Assigned — new/unrecognized campaigns surfaced (per user's "show new in the table" requirement)
Sampled from the live `?group=remaining&month=2025-01` diagnostic: campaigns like "Klarna_ALL_P_SAJEE" (35 orders, £747.90) appear that are NOT in any current group's confirmed list — a genuinely new 2025-era campaign name, correctly surfaced in Not Assigned rather than guessed into an existing group. Full detail available live via the Not Assigned tab / `?group=remaining` diagnostic endpoint.

## Files Modified/Created
- `reports/digital-marketing-member-pages/api/sales25.js` (new)
- `reports/digital-marketing-member-pages/scripts/bulk-sales25-refresh.js` (new)
- `reports/digital-marketing-member-pages/vercel.json`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `reports/digital-marketing-member-pages/api/data/sales25-*-2025-01.json` (11 snapshot files)
