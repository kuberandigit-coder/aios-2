## Purpose
Give Jefri's Performance tab the same clickable Total Cost popup as Sonya/Sajeepan/Kamsi/Dilaksi, adding the real cost components his DE-store data supports — no DM line (DE has no DM-46 concept), and no fabricated Transaction Fee or Shopify Subscription Fee.

## Business Question
Kuberan: "made jeffri page smooth like we done before for sonya and others and add all the cost like added for sonya there is no any dm champaign in de so add other costs and pop up view and update all caculations after cost updated".

## Investigation
Checked `salesde25.js`'s `jeffri-ads` combinedSummary — it computes real `discounts`/`refunds`, but has no `transactionFee` field (no `sumTransactionFees()`-equivalent exists for the DE endpoint). The Shopify Subscription Fee is documented elsewhere as the UK store's (ledsone.co.uk) Advanced-plan bill, split only among UK staff — applying it to Jefri (DE store, separate Shopify account) would be wrong, not approximate.

## Fix
Added Jefri to `COST_POPUP_MEMBERS`. `memberExtraCost()` and `openCostPopup()` now branch on a `DE_STAFF_ROUTING` check: DE-store members (Jefri, and later Sukirtha) get Total = Ads Cost + real Discount + real Refund only, with an on-page note explaining why Transaction Fee and Subscription Fee are absent rather than shown as fake £0.00.

## Files Modified
- `pages/muguntha.html`

## Status
PASS — verified live with real March 2025 data (discounts £742.57, refunds £520.27, both genuine).

## Reviewer
Kuberan
