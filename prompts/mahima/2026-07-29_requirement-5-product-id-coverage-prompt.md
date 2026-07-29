# Prompt — Mahima Requirement 5: Product ID Coverage

**Title:** Product ID Coverage Tab
**Purpose:** Show which Shopify Product IDs are running in Google Ads campaigns, which are not, how current performance compares to the previous period, and the correct business action.
**Requirement Source:** User task spec (twice-pasted, "Kuberan's AIOS project" framing), 2026-07-29 — originally labelled Requirement 4 in the spec, built as Tab 5 per user's follow-up instruction ("create the req 5 tab").
**Team Member:** Mahima
**Business Question:** Which Product IDs are covered by Mahima's Google Ads campaigns, which are missing entirely, and what should be done next (add, scale, maintain, reduce, pause, or fix the feed)?

## Exact logic specified (must not be changed)
- ROAS = Conversion Value / Cost, shown as %.
- ROAS Trend: ROAS > Previous ROAS → Up; ROAS < Previous ROAS → Down; else Flat.
- Suggested Action:
  - Not in campaign → feed not eligible = "Fix Feed First — Not Enrolled"; else "Add to Campaign".
  - In campaign → feed not eligible = "Optimize Feed"; else 0 conversions = "Pause"; ROAS ≥ 4 = "Scale"; ROAS ≥ 2.5 = "Maintain"; else "Reduce".
- Priority: Fix Feed First / Pause / Optimize Feed = High; Add to Campaign / Reduce = Medium; else Low.

## User decisions during build
- User confirmed reusing Req1's existing attribute-completeness proxy (10 `google_ads.merchant_products` columns) for Missing Attribute, and deriving Feed Status (Eligible/Not Eligible) from that same proxy, since no real Google Merchant Center diagnostics feed exists in PostgreSQL.
- User said "leave the feed status column" and to build the tab with live update and a clean single-view table — proceeded with the derived Feed Status approach already proposed, no separate "Data Missing" stop.
