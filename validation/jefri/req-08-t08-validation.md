# Jefri Req 8 — T-08 — Validation Record

**Evidence:** `evidence/jefri/req-08-t08-discovery.md`, `evidence/jefri/req-08-t08-postgres-source-mapping.md`
**Reviewer:** Claude Code (execution worker) · **Date:** 2026-08-20

## Validation checklist (per governing prompt §18)
| Item | Result |
|---|---|
| Requirement 8 source inspected | ✅ (CSV path inaccessible in this environment, embedded 13-step logic used as authoritative per the prompt's own instruction) |
| Existing Jefri assets searched | ✅ — no duplicate found, GREEN |
| Existing `jefri.html` inspected | ✅ — Req1–7 confirmed, no T-08 overlap |
| PostgreSQL sources inspected read-only | ✅ — only SELECT/information_schema queries issued |
| Shopify order source identified | ✅ (partial) — `order_management.orders` has `order_id`, `total`, `sub_total`, `shipping_cost`, `tax`; `sub_total` is the likely Order-Value-Excl-Shipping candidate but NOT confirmed against real order arithmetic (blocked before reaching that verification step) |
| Google Ads conversion source identified | ❌ — no transaction-level/conversion-level table exists |
| Transaction ID availability checked | ✅ checked — confirmed NOT available anywhere in DB |
| Method 1 implemented if available | N/A — not available |
| Method 2 implemented only if required | ❌ not implemented — its own required input (Delta) has no data source |
| Bid adjustment applied before Delta matching | ❌ not applicable — no bid-adjustment source exists |
| ±1 tolerance implemented | ❌ not implemented — no data to reconcile |
| Split rows generated correctly | ❌ not implemented |
| Split flag implemented | ❌ not implemented |
| Order Summary priority implemented | ❌ not implemented — no UTM data source exists |
| Attributed Date filtering implemented | ❌ not implemented |
| Shipping excluded | N/A — not reached |
| Reconciliation implemented | ❌ not implemented |
| Inferred attribution clearly labelled | N/A |
| Existing Jefri functionality preserved | ✅ — zero changes made to `pages/jefri.html`, nothing to break |
| No production data modified | ✅ — confirmed, read-only queries only |
| No unrelated files modified | ✅ |
| AIOS evidence saved | ✅ (this discovery/mapping) |
| AIOS prompt saved | ✅ |
| AIOS validation saved | ✅ (this file) |
| AIOS handover saved | ✅ |
| AIOS report saved | ✅ |
| Vercel documentation updated | ✅ (deployment-not-applicable note) |
| Final PASS/FAIL determined | **BLOCKED** (see below) |

## Test cases (§17 of the governing prompt)
The prompt's 5 supplied examples (ORD-20458, ORD-20460, ORD-20470, ORD-20465, ORD-20480) are **specification test cases only**, as the prompt itself anticipated ("If these examples are not present in the live database, document them as specification test cases rather than pretending they were live-data tests"). They were NOT run against live data — there is no live data to run them against, since the Google Ads transaction/delta data these examples depend on does not exist in this database. No fabricated database records were created to force these to pass, per explicit instruction.

## Final decision
**BLOCKED** — not PASS, not FAIL in the sense of a defective implementation, because no implementation was attempted once the governing prompt's own explicit STOP conditions were triggered by real discovery. Per the prompt's own PASS/FAIL rule: PASS requires "Correct Shopify and Google Ads sources were identified" (Google Ads side failed) and "Exact Transaction ID attribution is used when available" (not available) — so PASS is not achievable. FAIL is defined as building incorrectly / inventing logic / ignoring missing data — none of that occurred either. **BLOCKED** is the accurate status per the prompt's own vocabulary (referenced explicitly in §26's "Status: PASS / FAIL / BLOCKED").

## PASS/FAIL (as of original discovery, 2026-08-20 morning)
**BLOCKED — stopped at discovery per explicit governing-prompt STOP conditions, no code changes made, no data invented.**

---

# UPDATE — 2026-08-20 (same day, later): Steps 1-3 built and deployed live

**This does NOT invalidate the original BLOCKED finding above** — Method 1 (Transaction ID) is still confirmed absent, and the original discovery's PostgreSQL findings were all accurate. What changed: Kuberan supplied real bid-bonus € values from the Google Ads UI (not stored in Postgres, only the on/off flag is), and a second discovery pass found `google_ads.product_performance` (per-product granularity) succeeds where `campaign_performance` (per-day aggregate) failed. See `evidence/jefri/req-08-t08-attribution-discovery.md` for full proof-of-concept, including two independent exact-to-the-cent real-order matches found BEFORE any code was written.

## Steps now live (checklist update)
| Item | Result |
|---|---|
| Order Number + Order Value (Excl. Shipping) | ✅ LIVE — Shopify Admin API (`current_subtotal_price`/`currentSubtotalPriceSet`), not Postgres, per explicit instruction |
| Order Summary (Step 11) | ✅ LIVE — Shopify `customerJourneySummary` (real Conversion Summary data), classified Google Ads/Meta Ads/Direct/Organic/Other; see `req-08-t08-order-summary-discovery.md` for the Meta-mislabeling bug found and fixed before deploy |
| Transaction ID (Method 1) | ❌ still confirmed absent — unchanged from original discovery |
| Delta / Method 2 core mechanism | ✅ LIVE, but via a DIFFERENT real mechanism than originally specified — not `Current Update − Last Update` (still no historized source for that), but direct value-matching against `product_performance` (`conversions=1` rows) minus the real bonus amounts Kuberan supplied |
| Bid Value Adjustment (Step 4) | ✅ LIVE — real € bonus values for all 16 currently-active campaigns, supplied directly by Kuberan, hardcoded in `ACTIVE_CAMPAIGN_BONUS` |
| Single Match / Ambiguous / No match (Steps 5-7) | ✅ LIVE — labeled honestly, "Ambiguous" shown for manual review rather than silently resolved, matching Step 7's own "best-fit inference, not proof" caveat |
| One row per Campaign/Date (Step 8) | ⏳ not yet — currently one row per order showing its best/only attribution candidate(s) inline, not yet exploded into separate rows per split |
| Split reconciliation (Steps 9-10) | ⏳ not yet built |
| Date Filter by Attributed Date (Step 12) | ⏳ not yet — currently filtered by order created date range; Attributed Date is shown as a column, not yet a filter dimension |
| Shipping Rule (Step 13) | ✅ LIVE — `current_subtotal_price`, confirmed excl. shipping via real order arithmetic |

## Real validation (live data, 19-20 Aug 2026, 44 real orders — not the spec's fictional test cases)
- Two orders independently hand-verified against real Postgres data before building: `#LSDE19240` (€171.72 + €1.00 AOVU15 bonus = €172.72, `conversions=1`) and a second order (€51.61 + €0.70 Mahi-Klarna bonus = €52.31, `conversions=1`). Both reproduced exactly by the live endpoint after deployment.
- Full dataset breakdown: 20 Matched, 2 Ambiguous, 22 No match.
- Filters added for usability: Order Summary type, Attribution status, Campaign (dynamically populated from live data), CSV export.

## Known limitations (unchanged, still real)
- Matched `product_performance` row's product is NOT necessarily what the customer bought (verified on a real order) — matching is Campaign+Date+Value only, never product identity.
- "No match" (22 of 44 orders) does not mean the order wasn't from Google Ads — it means no single-conversion-day product row matched its value within the search window. This is an inference method's honest limitation, not a bug.
- Steps 8-10 and 12 (per-campaign/date row explosion, split reconciliation, Attributed-Date-based filtering) are not yet built.

## PASS/FAIL (current, 2026-08-20)
**PARTIAL PASS** — Steps 1, 2, 3 (Order Number/Value, Order Summary, Campaign+Attributed Date via Method 2) are implemented, live, deployed, and validated against real data with two independently hand-verified matches before build. Method 1 remains genuinely unavailable (unchanged). Steps 8-10 and 12 remain unbuilt. This is an honest incremental build, not a claim of full T-08 completion.
