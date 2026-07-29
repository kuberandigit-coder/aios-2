# Prompt — Thasitha Requirement 2: PMax Product Zero-Performance — Live Refresh

**Title:** Make Thasitha Req2 live
**Purpose:** Replace the static, build-time-frozen `R2_PRODUCTS` array (baked 2026-07-15/16) with a live PostgreSQL refresh, matching the pattern already applied to Req1/Req3 on 2026-07-28.
**Requirement Source:** User request, 2026-07-29 — "need to made thasitha req 2 also live data, first analysis the page and tell me is there any issue?"
**Team Member:** Thasitha
**Business Question:** Which PMax products have zero impressions/clicks/conversions and why (root-cause), kept current instead of frozen at a point in time.

## User decisions
- User asked for analysis first before building — analysis surfaced that the "Data Check" (GMC approval) column was still rendering despite the original 2026-07-15 discovery evidence saying it should be removed (real GMC data confirmed unavailable).
- User instruction: "use the same proxy as mahima, keep the column" — so Data Check stays, computed via the same 10-catalog-attribute-completeness proxy as Mahima's Feed Status, not real Merchant Center data (which does not exist anywhere in Postgres).
