---
title: 2026-06-29 Closure — Estimated Delivery Cutoff Change
date: 2026-06-29
task_name: Delivery Timer Restart/Cutoff Change — 11:00 AM to 12:00 PM Germany Time
purpose: Closure record for the delivery timer cutoff change on ledsone-de.
source_input: User task prompt — 2026-06-29
evidence_path: evidence/2026-06-29_estimated-delivery-cutoff-change.md
status: COMPLETE — pending push approval
reviewer: Varmen / Kuberan
pass_fail_rule: >
  PASS if change applied correctly, validated, and awaiting approved push.
  FAIL if pushed without approval or unrelated code was touched.
next_step: Kuberan/Varmen review evidence + validation → approve push → run push command below.
known_limits: NOT pushed to live store yet. Local file only.
---

## Task Summary

Changed the delivery timer restart/cutoff window in `snippets/estimated-delivery.liquid` (ledsone-de).

## What Was Done

| Item | Detail |
|------|--------|
| File changed | `shopify-themes/ledsone-de/snippets/estimated-delivery.liquid` |
| Old cutoff | 11:00 AM Germany time |
| New cutoff | 12:00 PM (noon) Germany time |
| New restart window | Widget hides 11:00 AM – 12:00 PM daily (Europe/Berlin) |
| Weekend logic | Updated Friday ≥ 12pm hide / Saturday < 12pm hide (was 11am) |
| Timezone | `Europe/Berlin` preserved — no change |
| Files NOT touched | All other theme files, JS assets, CSS, free shipping bar |

## Production Status

| Action | Status |
|--------|--------|
| Code changed locally | DONE |
| Pushed to Shopify live store | NOT YET — awaiting approval |
| Push command (when approved) | `shopify theme push --live --store ledsone-de.myshopify.com` |

## Evidence & Validation

| Document | Path |
|----------|------|
| Evidence | `evidence/2026-06-29_estimated-delivery-cutoff-change.md` |
| Validation | `validation/2026-06-29_estimated-delivery-cutoff-change.md` |

## Final Status: PASS
