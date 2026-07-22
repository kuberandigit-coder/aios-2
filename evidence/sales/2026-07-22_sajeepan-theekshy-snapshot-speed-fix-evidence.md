---
title: Sajeepan + Theekshy Tabs — Static Snapshot Speed Fix
date: 2026-07-22
type: evidence
---

# Title
Generated static snapshot files for Sajeepan's (March-June) and Theekshy's (March-June) closed months, using the permanent `scripts/generate-snapshots.js` tool built earlier today, cutting their tab load times from ~40-90+ seconds (live Shopify fetch) to ~1-2 seconds (static file).

# Purpose
User reported both tabs were "so much load" when switching — same root cause as the earlier Thasitha/Hetheesha/Thivagini speed fix (2026-07-21): no snapshot files existed yet, so every tab visit re-fetched the entire store's monthly orders live from Shopify.

# Business Question
Can staff switch between Sajeepan's and Theekshy's month tabs quickly, the same as every other staff tab on the dashboard?

# Requirement Source
Live user instructions:
1. "theeky tabs also so much loade made both sajeepan ann theesjhy speed an smooth what is the easy and quick way for this do that" — requested the fastest fix for both tabs.
2. "how can i see that in this terminal ?" — asked how to watch background progress (answered with a `Get-Content -Wait` command, no code change).
3. "code for theeky" — asked to see the Theekshy matching code (already documented in the prior evidence file; answered inline, no new code).

# Implementation
Reused `reports/digital-marketing-member-pages/scripts/generate-snapshots.js` (built during the earlier Sajeepan session today) — the "easy and quick way" was simply running the existing permanent tool instead of writing new code:

```
node scripts/generate-snapshots.js sajeepan-ads 2026-03 2026-04 2026-05 2026-06
node scripts/generate-snapshots.js theekshy-ads 2026-03 2026-04 2026-05 2026-06
```

Both ran as background tasks (each month is a full store-wide live Shopify fetch, 40-360s depending on order volume that month). Combined with the January/February Sajeepan snapshots already generated in the prior session, all of Sajeepan's Jan-Jun and Theekshy's Mar-Jun (her full historical range, since she joined in March) now have static snapshot files.

Notable finding from the run: Theekshy had **0 matched orders in March and April**, 6 in May, 26 in June — meaning her Google Ads campaigns likely didn't go live until May, despite joining the team in March. Flagged for user awareness, not treated as a bug (the utm_term=theekshy matching rule is confirmed correct; there's just no matching traffic in her first two months).

Deployed via `vercel --prod --yes`. Verified live: `staff=sajeepan-ads&month=2026-05` now returns `cacheStatus: "static-snapshot"` in **1.46 seconds** (previously required a live ~40-90s fetch every time).

# Files Modified
- `reports/digital-marketing-member-pages/api/data/sajeepan-uk-ads-sales-2026-0{3,4,5,6}.json` (new)
- `reports/digital-marketing-member-pages/api/data/theekshy-uk-ads-sales-2026-0{3,4,5,6}.json` (new)

No code changes — same script and snapshot mechanism already deployed for these two staff members earlier today.

# Evidence Location
This file.

# Validation Result
Live-verified: `staff=sajeepan-ads&month=2026-05` returns in 1.46s with `cacheStatus: static-snapshot` and the expected 202 matched orders (matches the snapshot-generation log). Sajeepan Jan-Jun and Theekshy Mar-Jun are both now fully snapshotted; only July (live month, by design) still does a live fetch for either.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending — user.

# Status
Deployed to Vercel production, verified live and fast.

# PASS / FAIL
PASS

# Next Step
1. Flag to user: Theekshy shows zero Google Ads sales in March/April — worth confirming with her/the ads account whether campaigns were actually live those months.
2. Git commit/push — pending explicit user permission per repo's standing rule.
