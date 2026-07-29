# Completion Report — salesuk.html: Not Assigned Order Assignment UI

**Title:** Assign-from-UI for Not Assigned
**Purpose:** Let a user assign an order from Not Assigned to a real group/person via a dropdown, persisted permanently.
**Requirement Source:** User request, 2026-07-29
**Files Modified/Created:**
- `reports/digital-marketing-member-pages/api/assign-order.js` (new)
- `reports/digital-marketing-member-pages/api/data/order-overrides.json` (new)
- `reports/digital-marketing-member-pages/api/salesuk.js`
- `reports/digital-marketing-member-pages/api/sales25.js`
- `reports/digital-marketing-member-pages/pages/salesuk.html`
- `reports/digital-marketing-member-pages/vercel.json`

**Evidence Location:** `evidence/salesuk/2026-07-29_not-assigned-order-assignment-evidence.md`
**Validation Result:** PASS (pre-token checks) — `validation/salesuk/2026-07-29_not-assigned-order-assignment-validation.md`
**Reviewer:** Not recorded.
**Status:** Deployed and live; functionally BLOCKED on the user adding `GITHUB_ASSIGN_TOKEN` to Vercel.

**Known Limitations:**
1. Requires `GITHUB_ASSIGN_TOKEN` (GitHub PAT) to be added to Vercel by the user before assignments actually save.
2. Historical (already-snapshotted) months need a bulk-refresh re-run after assignments to visibly reflect the change — same manual step every prior rule change required. The live current month (2026-07) updates immediately.

**Next Steps:** User adds the token; test one real assignment; re-run bulk-refresh for any historical month with new assignments.

**PASS/FAIL: PASS (blocked on external action, not a defect)**
