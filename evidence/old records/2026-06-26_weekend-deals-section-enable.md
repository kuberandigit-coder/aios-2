# Evidence — Weekend Deals Section Enable Fix

**Date:** 2026-06-26
**Store:** ledsone-de.myshopify.com
**Status:** PASS — Fixed and Pushed Live

---

## Problem

Weekend Deals section not showing on homepage despite correct JS time logic (Friday 11:45 Berlin).

## Root Cause

`templates/index.json` had `"disabled": true` on the `weekend_deals_C8JMjx` section entry. This prevented the section from rendering in the HTML entirely — the JS timer never ran because the element did not exist in the DOM.

## Fix

Removed `"disabled": true` from `templates/index.json` line 255.

## File Modified

| File | Change |
|------|--------|
| `templates/index.json` | Removed `"disabled": true` from weekend-deals section |

## Deployment

- Pushed live: `shopify theme push --live --store ledsone-de.myshopify.com`
- Git commit: `e3c7863`
- Pushed to GitHub: `kuberandigit-coder/ledsone-de-shopify-theme`

## Reviewer
Kuberan

## Next Step
Verify section appears on homepage after 11:45 Berlin time every Friday.
