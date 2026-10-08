# Evidence — Jefri Req1-5: Hardcoded 5-Campaign List Bug (permanent fix)

**Date:** 2026-10-08
**Project:** dm-dashboard
**Reported by:** Kuberan, via live screenshot — Req2 (Search Terms) showing real data for only
1 of 5 listed campaigns, and flagging Jefri actually has 8 campaigns.

## Investigation

1. Confirmed Req2's 4 zero-data rows are Pmax campaigns; `pmax_campaign_search_term_data` is a
   documented, pre-existing empty table (an upstream Google Ads feed-import gap, already called
   out in a code comment referencing the same issue found for Thasitha Req6) — a genuine separate
   data gap, not a code bug on its own.
2. But the deeper question ("why only 5 campaigns shown at all, not 8") led to `JEFRI_CAMPAIGNS` —
   a hardcoded 5-entry list at the top of `backend/app/staff_pages/jefri.py`, used by every one of
   Req1 through Req5.
3. Searched AIOS history for any prior finding about Jefri's real campaign count: found
   `evidence/muguntha/2026-08-05_multi-member-tabs-and-perf-fixes.md` (a **different, older**
   project — `digital-marketing-member-pages`, the Vercel staff-requirements dashboard) —
   documents the exact same bug already found and fixed there on 2026-08-05: cost was scoped to 5
   hardcoded campaign IDs, silently wrong, fixed by querying
   `google_ads.campaigns WHERE group_name='Jefri' AND account_id=9031058245`, confirmed to match
   all of Jefri's real campaigns (61 at the time, including historical/paused ones) against a real
   cost total from the Google Ads UI.
4. That fix was never ported into dm-dashboard's own, separate `jefri.py` — it kept its own
   independently-hardcoded 5-ID list the whole time.
5. Confirmed the same `group_name`/`campaign_status='ENABLED'` filtering convention is already used
   elsewhere in this exact codebase (`backend/app/admin/admin_dm_campaign.py`) for the same
   group/account — reused that convention rather than inventing a new one.

## Fix

`backend/app/staff_pages/jefri.py`:
- Replaced the hardcoded `JEFRI_CAMPAIGNS` list with `_refresh_jefri_campaigns()`, a 1-hour-TTL-
  cached live query against `google_ads.campaigns WHERE group_name='Jefri' AND
  account_id=9031058245 AND campaign_status='ENABLED'` — mutates `JEFRI_CAMPAIGNS`/
  `JEFRI_CAMPAIGN_IDS`/`CAMPAIGN_NAME_BY_ID` in place so every existing consumer keeps working
  unchanged.
- Falls back permanently to the original 5-campaign list on any query failure — never leaves the
  list empty.
- Wired `_refresh_jefri_campaigns()` into every consumer: Req1 (both the live handler and the
  scheduled-snapshot compute function), Req2, Req3, Req4, Req5.
- `JEFRI_CAMPAIGN_NAMES_R8` (a separate, position-indexed list used only for a UTM-source-pattern
  matching heuristic in Req8) was deliberately left untouched — it solves a different problem
  (fuzzy-matching a few distinguishable campaign naming patterns), not "list all campaigns."

## Validation

`python -m py_compile backend/app/staff_pages/jefri.py` — clean. No live click-through from this
session (no server/DB access) — the 1-hour cache and fallback-on-failure design means a bad query
degrades gracefully to the old known-good list rather than breaking the page.

## Files changed

`backend/app/staff_pages/jefri.py`. Commit `c7afdc5`, pushed to `dev-work`.

## Status

**Fixed and pushed.** Not yet merged to `main`, not yet live-verified. PMax search-term data (4 of
Jefri's campaigns) will still show 0 until the separate, documented upstream feed-import gap is
resolved — unrelated to this fix.
