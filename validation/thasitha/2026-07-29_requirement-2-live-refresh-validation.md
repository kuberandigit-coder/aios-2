# Validation — Thasitha Requirement 2: PMax Product Zero-Performance — Live Refresh

**Title:** Req2 live refresh validation
**Purpose:** Confirm the live endpoint and UI work correctly end-to-end.

## Checks performed
1. `node --check api/requirement.js` — syntax valid.
2. Query validated directly against live PostgreSQL with LIMIT before wiring the handler — correct shape, budget matched live `google_ads.campaigns.budget` values (€5.00 / €12.00), days_live computed correctly.
3. Live production endpoint `GET /api/requirement?fn=thasitha-req2&refresh=1`:
   - Initial deploy: `stockSourceError: "Could not fetch live stock from Shopify"` for all 926 rows, `fd` showing `"Mon Apr 27"` — both bugs found and fixed (see evidence doc), redeployed.
   - After fix: `stockSourceError: null`, 738 of 926 rows have a real stock quantity (rest are untracked variants, correctly `null`), `fd` showing correct ISO dates (`"2026-04-27"`).
   - Confirmed a 3rd Thasi PMax campaign (`24051146082`, added 2026-07-22) now appears automatically — proof the live query is genuinely dynamic, not still hardcoded to the original 2 campaigns.
4. Data Check distribution sampled: 300 "notapproved", 626 "nofeed" of 926 — consistent with the same proxy's behavior on Mahima's Req5 (most catalog rows are missing at least one of the 10 attribute columns).
5. HTML: `pages/thasitha.html` file size dropped from ~1.7MB to ~1.38MB after removing the dead static array; confirmed live via curl that `t2RefreshBtn`/`t2LiveChip` render on the deployed page.

## Result
**PASS** — Req2 is now live, self-refreshing every load (with IndexedDB restore + manual "Refresh Data" button matching Req1/Req3), Data Check column preserved per user instruction using the same non-fabricated proxy technique as Mahima's Feed Status, both real bugs found during the build were caught and fixed before calling it done.
