# Jefri Req 7 — T-07 B&Q/Amazon/Shopify Reconciliation — Validation Record

**Evidence:** `evidence/jefri/2026-08-19_req7-bq-amazon-shopify-reconciliation.md`
**Reviewer:** Claude Code (execution worker) · **Date:** 2026-08-19

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | Quantity=1, decimal price | unitPrice = orderPrice | Real line `LDMG95B2282PK`, £17.37 qty1 → orderPrice=£17.37, unitPrice=£17.37 | ✅ PASS |
| 2 | Quantity>1 | unitPrice = orderPrice/qty, NOT the raw total | Real line, item_price=13.74 qty2 → orderPrice=27.48, unitPrice=13.74 (matches DB's own per-unit item_price, confirms formula correctness) | ✅ PASS |
| 3 | Divide-by-zero protection | null, not a crash | Code path: `quantity > 0 ? ... : null` for both orderPrice and pricePerUnit | ✅ PASS (code review — no zero-qty row existed in the live sample to trigger it) |
| 4 | Amazon SKU exact match | Correct | Real line `LSCY290WH+RPR44WH`, exact row id 459706 found | ✅ PASS |
| 5 | Amazon SKU incorrect (mapped_sku only) | Incorrect + SKU Found populated | Real line `LDMG95B2282PK` → 0 exact rows, 2 mapped_sku rows → Incorrect, SKU Found = `LDMG95B2282PK S_DCVV` (deterministic pick) | ✅ PASS |
| 6 | Amazon SKU not found | Not Found | Test-data derived (Test 3 of governing prompt: Shopify not found) + code path confirmed (empty exact AND empty mapped array) | ✅ PASS (code review) |
| 7 | Amazon price runs ONLY when Correct | blank price/pct when Incorrect/Not Found | `priceCompare` only called when `validation === 'Correct'`, else `{pcts:[],prices:[]}` — confirmed in real `LDMG95B2282PK` line: amazonPriceListing1/2 both null | ✅ PASS |
| 8 | Amazon % per listing, not averaged | separate values | `pcts = prices.map(...)` — array, one entry per listing, no averaging step anywhere | ✅ PASS |
| 9 | Amazon Flag: High | High when >+2% and no <-2% | Real line `LSCY290WH+RPR44WH`: +22.3% → hasHigh=true, hasLow=false → High | ✅ PASS |
| 10 | Threshold +2.0% = Match | Match | `p > 2` strict inequality — exactly 2.0 is NOT >2, so treated as within Match range | ✅ PASS (code review, matches spec's "inclusive at ±2%") |
| 11 | Threshold +2.1% = High | High | `2.1 > 2` = true → High | ✅ PASS (code review) |
| 12 | Threshold -2.0% = Match | Match | `-2 < -2` is false → not Low → falls to Match | ✅ PASS (code review) |
| 13 | Threshold -2.1% = Low | Low | `-2.1 < -2` = true → Low | ✅ PASS (code review) |
| 14 | Mixed (one listing High, one Low) | Mixed | Governing prompt Test 1 (Amazon +4.7%/-4.0% → Mixed) matches `hasHigh && hasLow` branch exactly | ✅ PASS (code review against spec's own worked example) |
| 15 | Shopify same logic, fully independent | separate flags, no combined field | Real line `LSCY290WH+RPR44WH`: Amazon=High (+22.3%, one cause) AND Shopify=High (+3.8%, different cause, different price) computed via entirely separate `shop`/`amz` objects, no shared state | ✅ PASS |
| 16 | Shopify Not Found | Not Listed, no price compare | Real line `LDMG95B2282PK`: zero shopify rows (exact or mapped) → Not Found → Flag=Not Listed, price fields null | ✅ PASS |
| 17 | Duplicate exact-sku rows (same price) | shown as 2 listings, not deduped away, both still correctly flagged | Real line `LSCY290WH+RPR44WH` Shopify: 2 active rows both £13.49 → both surfaced as Listing 1/2, both +3.8% → High | ✅ PASS |
| 18 | Ambiguous mapped_sku (2 different candidate real SKUs) | deterministic pick, not random | Fixed during this validation pass (see evidence "Duplicate matching" section) — active-status-first then lowest id | ✅ PASS (fixed before this report) |
| 19 | Day-wise: no cross-date aggregation | one date per run | `BQ_LINES_QUERY` filters `order_date >= $1 AND < $1 + 1 day` — single calendar day only, no GROUP BY across dates | ✅ PASS |
| 20 | Regression: R1–R6 untouched | unaffected | Only additive changes made — `showReqTab` gained new lines, existing R1–R6 branches unchanged; `requirement.js` dispatch table gained one new line, no existing route modified | ✅ PASS (code review — diff is purely additive) |
| 21 | PostgreSQL inspection read-only | no writes | Every query run during discovery/validation was `SELECT`/`information_schema` — no INSERT/UPDATE/DELETE/DDL issued at any point | ✅ PASS |
| 22 | Inline JS syntax validity | no parse errors | All 6 `<script>` blocks on `jefri.html` parsed successfully via `new Function()` after the edit | ✅ PASS |
| 23 | Backend syntax validity | no parse errors | `node -c api/requirement.js` — clean, twice (before and after the determinism fix) | ✅ PASS |

## Not independently live-HTTP-tested
No local dev server was run; validation used direct Postgres queries replicating the exact SQL, plus manual trace of the JS decision logic against those real rows. This is a real limitation, documented in the evidence file's Known Limits — recommend a live smoke test immediately after deployment approval.

## Final decision
**GREEN** — all findable test cases in the live 2-line sample for 2026-08-19 passed; remaining cases (Not Found on Amazon, Mixed flag on a real row) verified by code review against the spec's own worked examples since no live row exercised them yet.

## PASS/FAIL
**PASS.**
