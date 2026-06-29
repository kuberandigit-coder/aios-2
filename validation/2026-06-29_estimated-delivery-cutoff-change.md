---
title: 2026-06-29 Validation — Estimated Delivery Cutoff Change
date: 2026-06-29
task_name: Delivery Timer Restart/Cutoff Change — 11:00 AM to 12:00 PM Germany Time
purpose: Validate that the correct file was changed, logic is correct, and no unrelated code was touched.
source_input: Code review of snippets/estimated-delivery.liquid after edits applied
evidence_path: evidence/2026-06-29_estimated-delivery-cutoff-change.md
status: COMPLETE
reviewer: Varmen / Kuberan
pass_fail_rule: >
  PASS if: single source confirmed, all 6 change points correct, Europe/Berlin timezone
  preserved, no unrelated code modified.
next_step: User approves → push via: shopify theme push --live --store ledsone-de.myshopify.com
known_limits: Live browser test not performed — requires Shopify CLI dev server.
---

## Validation Checks

| # | Check | Method | Result | PASS/FAIL |
|---|-------|--------|--------|-----------|
| 1 | Single source of truth | Grep all .js + .liquid for `getNextNoon`, `isWeekendHidden`, `DELIVERY_DAYS_*` | Only `snippets/estimated-delivery.liquid` matched | PASS |
| 2 | `isWeekendHidden()` Friday guard | Read line 703 | `hour >= 12` ✓ | PASS |
| 3 | `isWeekendHidden()` Saturday guard | Read line 704 | `hour < 12` ✓ | PASS |
| 4 | `getNextNoon()` target time | Read line 722 | `setHours(12, 0, 0, 0)` ✓ | PASS |
| 5 | `getNextNoon()` rollover condition | Read line 723 | `>= 12` ✓ | PASS |
| 6 | Restart-window hide (11am–12pm) | Read lines 745–749 | `if (nowHour >= 11 && nowHour < 12)` → hide ✓ | PASS |
| 7 | Delivery days cutoff | Read line 759 | `< 12` → DELIVERY_DAYS_BEFORE_NOON ✓ | PASS |
| 8 | Europe/Berlin timezone preserved | Read `getGermanTime()` lines 708–717 | `timeZone: 'Europe/Berlin'`, `hour12: false` — unchanged ✓ | PASS |
| 9 | Free shipping bar script untouched | Code review lines 776–874 | No changes ✓ | PASS |
| 10 | No other files modified | File scope check | Only `snippets/estimated-delivery.liquid` edited ✓ | PASS |

## Overall: PASS
