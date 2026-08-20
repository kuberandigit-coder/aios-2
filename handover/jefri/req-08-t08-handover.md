# Jefri Req 8 — T-08 Order Conversion Split by Campaign Date — Handover

**Status: BLOCKED at discovery.** No changes were made to `pages/jefri.html` or any other file — this task stopped per the governing prompt's own explicit STOP conditions, before writing any implementation code, exactly as instructed ("Do not work around a stop condition silently").

## Why it's blocked
Real-data PostgreSQL discovery (read-only, documented in full in `evidence/jefri/req-08-t08-postgres-source-mapping.md`) confirmed that **the data T-08 needs does not exist in this database**:
1. No Google Ads transaction-ID / conversion-level table exists anywhere — only campaign+date aggregates (`google_ads.campaign_performance`). Method 1 (exact attribution) is impossible.
2. No historical/versioned snapshot of `campaign_performance` exists — it's a flat, overwritten-in-place table, so "Current Update − Last Update" (Method 2's core input) cannot be computed. Method 2 is also impossible.
3. No bid-strategy-bonus data source exists anywhere (needed by Method 2 anyway, moot since Method 2 itself is blocked).
4. No UTM data source exists anywhere in the database (needed for the independent "Order Summary" column, regardless of the Google Ads blockers).

This isn't a naming/discovery gap that more searching would fix — multiple whole-database searches (not scoped to one schema) confirm these tables/columns genuinely don't exist yet.

## What's needed to unblock this
Pick one (or more) of:
1. **Set up a Google Ads conversion-level data import** (Transaction ID / Order Number per conversion) — this is the cleanest fix and matches the prompt's own "preferred and exact method." Likely needs a new ETL/import job feeding a new table, not something fixable purely in this dashboard.
2. **Start historizing `campaign_performance`** (e.g. append-only daily snapshots instead of upsert-in-place) so Method 2's Delta becomes computable going forward — note this only starts working from whenever historization begins, can't retroactively reconstruct past deltas.
3. **Get UTM tracking into the Shopify order pipeline** (separate from the Google Ads issue) if the "Order Summary" column is still wanted even without full campaign-split data.
4. Alternatively: **descope T-08** to whatever subset is actually answerable with existing data (e.g. campaign+date level conversion value only, without order-level splitting) — but that would be a materially different requirement than what's specified, so needs an explicit decision from Jefri/GPT, not an assumption made here.

## Files created (discovery/evidence only — no code)
- `prompts/jefri/req-08-t08-update-prompt.md`
- `evidence/jefri/req-08-t08-discovery.md`
- `evidence/jefri/req-08-t08-postgres-source-mapping.md`
- `validation/jefri/req-08-t08-validation.md`
- `handover/jefri/req-08-t08-handover.md` (this file)
- `reports/jefri/req-08-t08-report.md`
- `vercel/jefri/req-08-t08-vercel-deployment.md`

## Next step
Awaiting a decision from GPT/Jefri on which unblock path (above) to pursue. No further action will be taken on T-08 until real data becomes available or the requirement is explicitly descoped — per the governing prompt's own instruction not to invent business logic or fabricate data to force a PASS.
