# Jefri Req 7 — T-07 B&Q → Amazon → Shopify SKU & Price Reconciliation — Governing Prompt

**Date received:** 2026-08-19
**Team Member:** Jefri
**Requirement:** T-07

## Business purpose
Process B&Q order lines day-wise and verify, per line: B&Q order SKU, B&Q price per unit, Amazon SKU correctness, Amazon listing prices, Amazon price variance vs B&Q, Amazon reconciliation flag, Shopify SKU correctness, Shopify listing prices, Shopify price variance vs B&Q, Shopify reconciliation flag. Amazon and Shopify are evaluated independently — never combined into one marketplace flag.

## Authoritative field list (do not change)
Order Date · B&Q Order SKU · Order Quantity · B&Q Order Price · B&Q Price Per Unit · Amazon SKU Validation · Amazon SKU Found (if different from B&Q) · Amazon Price – Listing 1 · Amazon Price – Listing 2 · Shopify SKU Validation · Shopify Price – Listing 1 · Shopify Price – Listing 2 · Amazon % vs B&Q (per listing) · Shopify % vs B&Q (per listing) · Amazon Flag · Shopify Flag

## Calculation logic (verbatim intent, condensed)
- One processing run = one calendar day. Never aggregate across dates.
- `B&Q Price Per Unit = B&Q Order Amount / Order Quantity` (divide-by-zero protected). ALL marketplace comparisons use this, never the raw order total.
- Amazon SKU validation runs BEFORE any Amazon price comparison: exact match on B&Q SKU = Correct; listing exists under a different SKU = Incorrect (surface "Amazon SKU Found"); no listing = Not Found.
- Price comparison only runs when validation = Correct. Otherwise price fields stay blank and price-based flag logic does not run.
- Per-listing %: `((Listing Price − B&Q Price Per Unit) / B&Q Price Per Unit) × 100`, computed separately per listing, never averaged.
- Flag (±2%, inclusive at exactly ±2.0%): Match = all listings within −2%..+2% · High = ≥1 listing >+2% and none <−2% · Low = ≥1 listing <−2% and none >+2% · Mixed = ≥1 on each side · Fix {Marketplace} SKU First = validation Incorrect · Not Listed = validation Not Found.
- Shopify follows identical logic, fully independent of Amazon. No combined "Overall Marketplace Flag."
- No hardcoded live data — the prompt's sample test cases are validation-only, never a substitute for the real data source.
- STOP conditions apply if any required data source cannot be identified, SKU logic can't be verified, or price basis is ambiguous — document rather than invent.

## Full original prompt
See conversation history 2026-08-19 (Claude Code session, Jefri AIOS) — the complete verbatim governing prompt (sections 1–27, including sample test data Tests 1–4, STOP conditions, and the required final-response format) was supplied directly by the user/GPT planning layer and is treated as authoritative for this build. Not re-pasted here in full to avoid duplicating a very long source document; this file records the operative rules actually implemented (above) plus every decision point where the live data required a judgment call (see evidence file for those).
