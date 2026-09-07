# Handover — Open items from 2026-09-07 (dm-dashboard)

**Date:** 2026-09-07
**Project:** dm-dashboard

## 1. Mahima-style cache backfill for other staff
The root cause behind Mahima's Aug 2026 "showing 0" bug (a never-viewed
closed month's lazy-load fallback path computes live but never persists
to Postgres cache) is a general gap, not Mahima-specific — it likely
affects any other staff's closed 2026 months that haven't been manually
viewed/refreshed yet. Offered to run the same backfill across everyone;
**awaiting go-ahead**, not yet done.

## 2. aios-kuberan archive gap: 2026-08-24 to 2026-09-06
dm-dashboard development started 2026-08-24 (250 commits since). Before
today, `aios-kuberan/requirements/` had zero entries for this entire
project — last entry was 2026-06-26, from before dm-dashboard existed.
Today (2026-09-07) is now archived (see `closure/`, `evidence/`,
`handover/` dated 2026-09-07). **The ~2-week gap in between (Aug 24 –
Sep 6) has not been backfilled** — would need reconstructing from git
commit history day by day. Discussed with user; decision on whether to
do this retroactively is still pending.

## 3. Deploy automation (Option B) — declined for now
User explicitly decided manual deploy is safer over a fully-automated
one-click deploy (which would've needed a secured server-side endpoint +
narrow sudoers rule). If this preference changes later, the plan/tradeoffs
were already discussed in detail in-session — no new discovery needed,
just pick back up from there.
