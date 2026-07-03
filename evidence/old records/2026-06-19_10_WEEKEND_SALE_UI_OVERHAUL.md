# 10 — Weekend Sale Section — Full UI Overhaul

**Date:** 2026-06-19
**File:** `sections/weekend-sale.liquid`

## What changed

### Layout
- Header redesigned as flex row — heading + subheading on the left, timer on the right (same line)
- Added `.ws-container` with max-width 1480px and centered layout
- Section has no background color — inherits the page background (removed `bg_color` setting)

### Timer
- Moved from below heading (centered, large block) → right side of heading (compact pill)
- Redesigned as a slim horizontal pill with accent background and pill border-radius
- Font size reduced from 2.2rem → 1.05rem (less than half the size)
- Label sits above the pill, small caps, right-aligned

### Slider — products per row
- Desktop (>1000px): **5 products** (was 4)
- Tablet (601–1000px): **3 products** (was 2)
- Mobile (≤600px): **2 products** (was 1)
- CSS gap reduced to 14px desktop, 10px mobile
- JS `getVisible()` updated to return 2 / 3 / 5

### Product cards
- More compact: smaller image fetch (480px), reduced padding, smaller fonts
- Body padding: 10px 11px (was 12px 14px)
- Title: 0.8rem (was 0.9rem), price: 0.85rem (was 0.95rem)
- CTA button: 0.75rem, 8px padding (was 0.85rem, 10px)
- Mobile: vendor hidden, further reduced padding

### Always show toggle
- New schema checkbox: "Always show (UI mode)" — default true
- When ON: section always visible regardless of schedule (for UI work)
- When OFF: section follows Friday 13:00 → Sunday 23:59 schedule
- Works in both Liquid (skips the CSS hide tag) and JS (bypasses schedule check)

## Outcome
Professional, compact UI. When UI work is done, merchant unchecks "Always show" in theme editor — no code change needed.
