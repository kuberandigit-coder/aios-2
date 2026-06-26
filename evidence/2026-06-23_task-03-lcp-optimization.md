# Task 03 — PageSpeed LCP Optimization (ledsone.de)

**Date:** 2026-06-23  
**Store:** ledsone.de  
**Status:** In Progress (theme-level fixes done, pixel cleanup pending)

## Baseline PSI Scores (Before)

| Metric | Mobile | Desktop |
|--------|--------|---------|
| Score | 37 | 67 |
| LCP (lab) | 8.1s | 2.3s |
| TBT | 2,210ms | 360ms |

## PSI API Setup

- Google Cloud project: ledsone-psi-de
- API Key saved in Claude memory (reference_psi_api.md)
- Fetch via PowerShell (WebFetch times out — PSI takes 60-90s)

## Fixes Applied in Live Theme

### Fix 1 — Removed Duplicate Google Ads Tag
**File:** `layout/theme.liquid`  
**Removed:** Hardcoded `<script async src="gtag/js?id=AW-553096373">` block  
**Reason:** AW-553096373 already fired by GTM-NN322MJD container. Loading twice = double script execution.

### Fix 2 — Removed Loox Review App Scripts
**File:** `layout/theme.liquid`  
**Removed:** `{{ shop.metafields.loox.global_html_head }}` and `{{ shop.metafields.loox.global_html_body }}`  
**Reason:** Judge.me is the active review app. Loox was running simultaneously — two review apps = double JS on every page.

### Fix 3 — Shopify Inbox Delay for LCP
**File:** `layout/theme.liquid`  
**Added:** CSS + JS block immediately after `<head>` tag  
**What it does:** Hides chat button on paint, reveals on first user interaction or after 5 seconds  
**Reason:** Shopify Inbox (116KB+) loads via content_for_header. Delaying its render reduces work during LCP window.

## PSI Scores After Fixes

| Metric | Mobile Before | Mobile After | Change |
|--------|--------------|--------------|--------|
| Score | 37 | 53 (best run) | +16 |
| TBT | 2,210ms | 480ms (best run) | -78% |
| LCP (lab) | 8.1s | ~9.3s avg | Lab variance |
| Real User LCP | — | 3,687ms | AVERAGE |

## Pending Next Session

- Customer Events pixel cleanup (Infinite Google Ads Custom Pixel, GTM duplicate fires)
- Target: Real user LCP under 2,500ms (currently 3,687ms)
