# Jefri Req 8 — T-08 Order Conversion Split by Campaign Date — Governing Prompt

**Date received:** 2026-08-20
**Team Member:** Jefri · Channel: Google Ads
**Requirement:** T-08 — Order Conversion Split by Campaign Date

## Requirement source
Referenced source file `/mnt/data/What_I_Need_To_Improve_ADS_Performance - Jefri.csv` was **not accessible** in this environment (that path does not exist on this machine — it appears to be a path convention from a different execution environment, not this one). The prompt itself states its embedded 13-step logic is authoritative regardless, so that logic (below) was used as the specification. This CSV inaccessibility is recorded here for traceability but is NOT the reason this task stopped (see evidence file for the actual, data-availability-based stop reason).

## Required output fields
Order Number · Order Value (Excl. Shipping) · Order Summary (UTM Term / Direct / Organic / Other) · Campaign · Attributed Date · Conv. Value Added to This Campaign/Date · Split Across Multiple Campaigns/Dates?

## 13-step logic (condensed, authoritative)
1. Order-centric: for each Shopify order, find every Google Ads Campaign+Attributed Date where its conversion value appears.
2. **Method 1 (preferred, exact):** if Google Ads conversion tracking passes Transaction ID / Order Number, filter conversion data by it directly. 1 row = Single, >1 row = Split.
3. **Method 2 (fallback only):** if no Transaction ID, compute `Delta = Current Update − Last Update` per campaign/date row.
4. Apply bid-strategy bonus adjustment (New Customer bonus, High Value Customer bonus, etc.) to the Delta BEFORE judging Single/Split. Never invent the bonus value/source.
5. Single confirmed when `Adjusted Delta ≈ one Order Value` (±1 tolerance), no other unexplained delta in the window.
6. Split confirmed when combined adjusted deltas ≈ Order Value (±1 tolerance) across multiple campaign/date rows.
7. Method 2 is best-fit inference, not proof — must be labeled `Inferred — Delta Matching` vs `Exact — Transaction ID`.
8. One output row per Campaign+Attributed Date touched by an order — never collapsed.
9. Reconciliation: `ABS(SUM(allocated) − Order Value) <= 1` → PASS, else FAIL, never hidden.
10. Split flag: >1 campaign/date row → Yes, else No.
11. Order Summary computed once per order (utm_term → Direct → Organic → Other priority), same value on every split row.
12. Filter by **Attributed Date**, not Shopify order date.
13. Order Value must be **excluding shipping** — verify the correct Postgres field, don't guess.

## STOP conditions explicitly listed in this prompt (relevant ones triggered — see evidence file)
"Transaction ID logic is unclear" · "Delta source is unavailable" · "bid adjustment source is unavailable when Method 2 is required" · "required data does not exist" · "you would need to invent data or business logic" — **all four of these were triggered by real, read-only PostgreSQL discovery.** Full detail in `evidence/jefri/req-08-t08-discovery.md` and `evidence/jefri/req-08-t08-postgres-source-mapping.md`.
