---
title: 2026-06-29 Estimated Delivery — Cutoff Changed to 11AM–12PM Restart Window + 12PM Target
date: 2026-06-29
task_name: Delivery Timer Restart/Cutoff Change — 11:00 AM to 12:00 PM Germany Time
purpose: >
  Change the delivery timer cutoff from 11:00 AM to 12:00 PM (noon) Europe/Berlin time,
  and add a daily restart/reset window (11:00 AM–12:00 PM) during which the widget is hidden.
  This ensures orders placed before noon qualify for 2-day delivery and the timer
  transitions cleanly without showing stale data.
source_input: User task prompt — 2026-06-29
evidence_path: evidence/2026-06-29_estimated-delivery-cutoff-change.md
status: COMPLETE
reviewer: Varmen / Kuberan
pass_fail_rule: >
  PASS if: single source found, only cutoff/restart logic changed,
  Europe/Berlin timezone preserved, no unrelated code touched, evidence saved.
next_step: User reviews then approves push to live store via: shopify theme push --live --store ledsone-de.myshopify.com
known_limits: >
  Change is local only — not pushed to Shopify live store.
  Tested by code review only; live browser test requires Shopify CLI dev server.
  Free shipping bar script (second <script> block) was NOT modified.
  Commented-out old version (lines 1–274) was NOT modified — it remains archived.
---

## Objective

Change the delivery timer cutoff window to **11:00 AM – 12:00 PM Germany time**:
- Timer counts down to **12:00 PM (noon)** — not 11:00 AM
- Widget is **hidden 11:00 AM – 12:00 PM** daily (the restart/reset window)
- Weekend logic updated consistently to noon boundary

---

## File Touched

| File | Type | Location |
|------|------|----------|
| `snippets/estimated-delivery.liquid` | Liquid snippet | `shopify-themes/ledsone-de/snippets/` |

**Included from:** `sections/main-product.liquid` line 871 — `{% render 'estimated-delivery' %}`

**No other files modified.**

---

## Source of Truth Confirmation

- Only ONE file controls delivery timer logic: `snippets/estimated-delivery.liquid`
- No duplicate JS files found — `getNextNoon`, `DELIVERY_DAYS_*`, `isWeekendHidden` exist nowhere else
- `getGermanTime()` already used `Europe/Berlin` IANA timezone — no change needed

---

## Old Logic vs New Logic

### isWeekendHidden() — weekend visibility guard

| | Before | After |
|---|---|---|
| Friday cutoff | `hour >= 11` (hide from 11am) | `hour >= 12` (hide from noon) |
| Saturday restart | `hour < 11` (show from 11am) | `hour < 12` (show from noon) |

### getNextNoon() — countdown target

| | Before | After |
|---|---|---|
| Target time | `setHours(11, 0, 0, 0)` — 11:00 AM | `setHours(12, 0, 0, 0)` — 12:00 PM |
| Rollover condition | `getHours() >= 11` | `getHours() >= 12` |

### updateTimers() — daily restart window (NEW) + delivery days cutoff

| | Before | After |
|---|---|---|
| Restart-window hide | Not present | Added: hide if `nowHour >= 11 && nowHour < 12` |
| `container.style.display = 'inline-flex'` | Set in `else` of `isWeekendHidden` check | Set after restart-window check passes |
| Delivery days cutoff | `getHours() < 11` → +2 days | `getHours() < 12` → +2 days |

---

## Exact Lines Changed (post-edit line numbers)

| Line | Change |
|------|--------|
| 703 | `hour >= 11` → `hour >= 12` (isWeekendHidden Friday) |
| 704 | `hour < 11` → `hour < 12` (isWeekendHidden Saturday) |
| 722 | `setHours(11, 0, 0, 0)` → `setHours(12, 0, 0, 0)` (getNextNoon target) |
| 723 | `>= 11` → `>= 12` (getNextNoon rollover) |
| 742–749 | Added `nowHour` variable + 11am–12pm restart-window hide block |
| 751 | `container.style.display = 'inline-flex'` moved here (after restart check) |
| 759 | `< 11` → `< 12` (delivery days before/after noon branch) |

---

## Germany Timezone Handling

`getGermanTime()` (lines 708–717) uses:
```js
now.toLocaleString('en-US', { timeZone: 'Europe/Berlin', hour12: false })
```
- IANA timezone `Europe/Berlin` — handles CET (UTC+1) and CEST (UTC+2) automatically
- All cutoff comparisons use this German-time object — **no change needed to timezone logic**

---

## Behaviour After Change

| Time (Germany/Berlin) | Widget State | Timer Shows | Delivery Date |
|----------------------|--------------|-------------|---------------|
| Mon–Fri before 11:00 AM | VISIBLE | Countdown to 12:00 PM | Today + 2 days |
| Mon–Fri 11:00 AM–11:59 AM | **HIDDEN** (restart window) | — | — |
| Mon–Fri 12:00 PM–11:59 PM | VISIBLE | Countdown to tomorrow 12:00 PM | Today + 3 days |
| Friday 12:00 PM onwards | HIDDEN (weekend) | — | — |
| Saturday before 12:00 PM | HIDDEN (weekend) | — | — |
| Saturday 12:00 PM onwards | VISIBLE | Countdown to Sunday? | resumes normal |
| Sunday | VISIBLE | Normal | Normal |

---

## Code NOT Changed

- `getGermanTime()` — timezone logic correct, untouched
- `formatTimer()` — display format untouched
- `DELIVERY_DAYS_BEFORE_NOON` / `DELIVERY_DAYS_AFTER_NOON` constants — untouched (still 2/3)
- Free shipping bar script (`<!-- FREE SHIPPING BAR SCRIPT -->`) — untouched
- Express delivery badge — untouched
- All CSS — untouched
- Commented-out archived block (lines 1–274) — untouched

---

## Validation Steps

1. Open live product page with Shopify CLI: `shopify theme dev --store ledsone-de.myshopify.com`
2. Check at 10:00 AM Berlin: widget visible, timer shows ~2h countdown to noon
3. Check at 11:05 AM Berlin: widget HIDDEN (restart window)
4. Check at 12:01 PM Berlin: widget visible, timer shows ~23h 59m countdown to tomorrow noon
5. Check Friday 11:59 AM Berlin: restart window — widget hidden
6. Check Friday 12:01 PM Berlin: weekend — widget hidden
7. Check Saturday 11:59 AM Berlin: weekend — widget hidden
8. Check Saturday 12:01 PM Berlin: widget visible

---

## PASS / FAIL

**PASS** — Single source confirmed, minimum change applied, Europe/Berlin timezone preserved,
no unrelated code touched, evidence saved. Ready for user review before push.
