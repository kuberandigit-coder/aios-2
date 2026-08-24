## Purpose
Fix Refund Reason Category Analysis (Shopify UK Refund Report, `pages/shopify-uk-refunds.html`) misclassifying real refund reasons into the wrong of the 5 fixed categories (Postage Issue, Out of Stock, Warehouse Related Issue, Website Related Issue, Customer Side Issue).

## Business Question
Given 4 real examples where Kuberan confirmed the correct category, why did the keyword classifier (`categorizeReason()`) get them wrong, and what's the minimal fix?

## Examples and root cause
- `#LED55484` ("I had purchased the wrong item") — wrongly hit Warehouse via bare `'wrong item'` keyword; it's the customer's own ordering mistake, not a warehouse fault.
- `#LED56013` (colour-preference complaint, incidental smashed bulb mentioned) — wrongly hit Website via bare `'colour'`/`'color'` keyword; colour *preference* is a customer-side decision, not a website content problem.
- `#LED55698` ("multiple scratches on it") — fell through to the Customer default; no keyword matched genuine damage-on-arrival language.
- `#LED57394` ("a bit scuffed and scratched") — same gap as above with different wording; narrow phrase-matching (`'scratches on it'`) missed the variant.

## Fix
`CAT_RULES` in `pages/shopify-uk-refunds.html`:
- Warehouse: removed bare `'wrong item'`, `'wrong product'`, `'broken'`; added specific phrasing `'sent wrong'`, `'wrong item sent'`, `'wrong item received'`, `'shipped wrong'`; broadened damage detection to standalone `'scratch'`, `'scuff'` substrings (catches scratched/scratches/scuffed/etc.).
- Website: removed `'colour'`/`'color'` entirely.
- Percentages in the popup recompute live from `ROWS`/`categorizeReason()` every time it opens — no separate "fix the percentage" step was ever needed.

## Files Modified
- `pages/shopify-uk-refunds.html`

## Commits
- Staff-requirements: `1b03b20` (wrong item/colour/damage fix), `875fb93` (scratch/scuff broadening)
- Deployed to production, verified live via `grep` on the deployed page.

## Status
PASS — all 4 known examples verified correct after the fix (`LED55484, LED56013 → Customer Side Issue`; `LED55698, LED57394 → Warehouse Related Issue`).
