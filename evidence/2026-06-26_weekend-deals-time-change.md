# Evidence — Weekend Deals Start Time Change

**Date:** 2026-06-26
**Store:** ledsone-de.myshopify.com
**Status:** PASS — Pushed Live

---

## Purpose

Change the Weekend Deals section auto-show start time from Friday 13:00 to Friday 11:45 (Berlin time / Europe/Berlin timezone).

---

## File Modified

`shopify-themes/ledsone-de/sections/weekend-deals.liquid`

---

## Exact Change

| # | Element | Old Value | New Value |
|---|---------|-----------|-----------|
| 1 | Comment | `Fri 13:00 (780 min)` | `Fri 11:45 (705 min)` |
| 2 | Condition | `b.mins >= 780` | `b.mins >= 705` |

---

## Full Schedule After Change

| Day | Show | Hide |
|-----|------|------|
| Friday | **11:45 Berlin** | — |
| Saturday | All day | — |
| Sunday | All day | **23:59 Berlin** |
| Mon–Thu | Hidden | Hidden |

---

## Logic Location

`sections/weekend-deals.liquid` — line 516 (JS `isSaleActive()` function)

---

## Deployment

- Pushed live: `shopify theme push --live --store ledsone-de.myshopify.com`
- Confirmed by user: Yes

---

## Reviewer

Kuberan

## Next Step

None — section now auto-shows every Friday from 11:45 Berlin time.
