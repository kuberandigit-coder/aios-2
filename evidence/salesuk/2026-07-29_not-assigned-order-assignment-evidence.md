# Evidence — salesuk.html: Not Assigned Order Assignment UI

**Title:** Assign-from-UI — build evidence
**Purpose:** Record the architecture, since there is no database in this stack.

## Why this needed design work first
`salesuk.js`/`sales25.js` are stateless serverless functions reading static JSON snapshot files bundled at deploy time; Vercel's filesystem is read-only/ephemeral at runtime. There is nowhere to durably "save" a UI action without either (a) a database (none exists here) or (b) committing the change back to the git repo Vercel already auto-deploys from. Chose (b) — same mechanism already used for every other rule change this session (edit code/data, push, auto-deploy).

## What was built
- **`api/data/order-overrides.json`** — a small JSON object, `{ "<shopifyOrderId>": { groupKey, source, month, orderName, assignedAt } }`.
- **`api/assign-order.js`** (new serverless function) — `POST` endpoint that:
  1. Validates `groupKey` against an explicit allowlist of the 10 real group keys (never accepts an arbitrary string) and `source` against `{salesuk, sales25}`.
  2. Reads the current `order-overrides.json` from the `Staff-requirements` GitHub repo via the Contents API (`GET /repos/{repo}/contents/{path}`).
  3. Merges in the new assignment, keyed by the order's Shopify numeric ID (`legacyResourceId`).
  4. Commits it back via `PUT /repos/{repo}/contents/{path}`, which triggers the same auto-deploy every other push in this project does.
  5. Requires a `GITHUB_ASSIGN_TOKEN` env var (a GitHub PAT with write access) — added by the user directly in Vercel, never passed through chat.
- **`salesuk.js` / `sales25.js`** — both now call `loadOverrides()` (reads the same JSON file from the local bundled `api/data/`) and check it in `assignGroup()` **before** running the normal `GROUPS` rules, keyed by `order.legacyResourceId` and gated on the override's `source` field matching the file (`salesuk` vs `sales25`) so a 2025 assignment can never accidentally apply to a 2026 order or vice versa.
- **`salesuk.html`** — the orders table now has an "Assign" column, populated only when viewing the Not Assigned tab (`assignCellHtml()`): a dropdown of the 10 real group names + an "Assign" button per row. Clicking it POSTs to `/api/assign-order` with the order's Shopify ID, name, chosen group, current API source (`assignSourceFor(CURRENT_MONTH)`), and month, then shows inline Saving.../Saved/Failed status text.

## Known limitation (documented directly in code comments and to the user)
Historical months use a **static-snapshot fast path** — `handleGroup()` returns a pre-generated JSON file immediately if one exists, without ever running the per-order loop where `assignGroup()`/overrides are checked. So committing an override alone does not instantly move an order in an already-generated month's tabs; the affected group's (and Not Assigned's) snapshot needs regenerating via the existing `bulk-salesuk-refresh.js`/`bulk-sales25-refresh.js` scripts — the same manual step every other rule change in this project has always required. This is disclosed in the UI's "Saved" message ("will move to its tab after the next dashboard refresh") and should be run by Claude/the user after a batch of assignments.

## Files Modified/Created
- `reports/digital-marketing-member-pages/api/assign-order.js` (new)
- `reports/digital-marketing-member-pages/api/data/order-overrides.json` (new)
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/api/sales25.js`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `reports/digital-marketing-member-pages/vercel.json`
