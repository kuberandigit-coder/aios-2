# 2026-07-22 — Sukirtha UK Email Tab: Add July (Live)

**Task:** Wire July month-to-date data into Sukirtha's UK Email sales tab.

**Purpose:** This tab never had July wired in when originally built or during the same-day API consolidation (`456feb2`) — `SUPPORTED_MONTHS` capped at June and `resolveReportMonth` had no live/month-to-date concept, always fetching a full closed month. Brings the Email tab in line with every other tab that already supports a live current month.

**Commit:** `41ce912` — "feat: 2026-07-22 - add July (live) to Sukirtha UK Email tab"

**Fix:** Added `CURRENT_LIVE_MONTHS`, month-to-date date capping, an `isLive` flag, plus a July tab and Refresh button on the client — same pattern used elsewhere on the sales dashboard.

**Evidence:** `evidence/sukirtha/2026-07-22_sukirtha-uk-email-july-live-tab-evidence.md`
**Validation:** `validation/sukirtha/2026-07-22_sukirtha-uk-email-july-live-tab-validation.md`
**Closure:** `closure/sukirtha/2026-07-22_sukirtha-uk-email-july-live-tab-closure.md`

**Status:** Deployed same day as part of the sales dashboard consolidation work.
**Reviewer:** Not recorded in commit.
**Next step:** None outstanding.
