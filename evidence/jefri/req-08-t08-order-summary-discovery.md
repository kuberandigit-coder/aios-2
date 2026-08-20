# Jefri Req 8 — T-08 — Order Summary (Step 2) Discovery & Evidence

**Date:** 2026-08-20 · **Team Member:** Jefri · **Requirement:** T-08, Step 11 (Order Summary)

## What was discovered
Shopify's GraphQL Admin API exposes `Order.customerJourneySummary` — the exact same "Conversion summary" panel visible on each order's admin page — including `firstVisit`/`lastVisit` with `source` and `utmParameters { source medium campaign term }`. This is a real, live, per-order attribution signal Shopify itself already tracks, and is NOT the blocked Google Ads transaction-level data.

## Live spot-check (10 real orders, ledsone.de, before building)
Confirmed real values including: `source: "Google"` with `utmParameters: {source: "Shoptimised", medium: "AOVB15", campaign: "Shopping", term: "Jeff"}`, `source: "direct"` with `utmParameters: null`, and one order with `source: "Meta"` carrying its own UTM tags (Facebook/Instagram ads).

## Bug found and fixed before deploying
Initial classification logic treated ANY order with non-null `utmParameters` as Google Ads, then tried to match it against Jefri's known campaigns — this mislabeled the real Meta-sourced order (`#LSDE19256`) as "Google Ads (unmatched tag: Meta / DIY_Renovation_Audience / ABOl / ...)". Fixed by checking the journey's own `source` field FIRST to determine the platform (Google / Meta / other), and only attempting Google-campaign matching when the platform itself is confirmed Google.

## Campaign matching (UTM fragments -> full campaign name)
Google Ads Shopping/PMax UTM tracking templates on these campaigns encode fragments of the real campaign name into separate UTM fields (e.g. `source=Shoptimised, medium=AOVB15, campaign=Shopping, term=Jeff` for the campaign literally named `Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05`). Matched using unambiguous keyword rules against the known campaign list (initially Jefri's 5, later expanded — see handover for status); when a combination doesn't confidently map to exactly one known campaign, the raw UTM tags are shown instead of guessing (e.g. `Google Ads (unmatched tag: google / klarna / 36_pmax / mahi)`).

## Status
Live in production since 2026-08-20. See `pages/jefri.html` req8Tab, `orderSummaryType`/`orderSummaryDisplay` fields in `/api/requirement?fn=jefri-req8-orders`.
