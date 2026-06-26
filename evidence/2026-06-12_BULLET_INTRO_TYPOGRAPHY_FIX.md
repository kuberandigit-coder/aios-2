# Bullet Points — Intro Paragraph Typography Fix

**Project:** Blog Builder Tool (`index.html`)
**Date:** 2026-06-12

## Issue
The "Intro Paragraph" field inside the Bullet Points section rendered with tighter spacing than every other content section. Typed and pasted content looked cramped compared with the Introduction / main content paragraphs.

## Root Cause
The `.bullets-intro` CSS class only set `margin-bottom:18px`. It had **no** `font-size`, `line-height`, or `color`, so it fell back to the browser default `line-height: normal` (~1.2) instead of the site's configured `1.9`. In the multi-paragraph case, the inner `<p>` tags also lacked the `14px` bottom margin used by real content paragraphs (`.sb p`).

## Fix
Grouped `.bullets-intro` with `.sb` (the main content paragraph style) in all four relevant places so it inherits identical typography at every breakpoint — no new classes, no global changes:

1. Base rule → `.sb,.bullets-intro{font-size…line-height…color…}`
2. Paragraph margins → `.sb p,.bullets-intro p{margin-bottom:14px;}` (+ `:last-child`)
3. `@media(max-width:768px)` → `.sb,.bullets-intro{font-size:clamp(14px,3.8vw,…)}`
4. `@media(max-width:480px)` → `.sb,.bullets-intro{font-size:14px;line-height:1.75;}`

`.bullets-intro{margin-bottom:18px;}` kept for its own block spacing.

## Files Changed
- `index.html` — 4 CSS edits inside `buildCSS()`

## Outcome
- font-size, line-height, color, paragraph margins now identical to other content sections at all screen sizes.
- letter-spacing / word-spacing / white-space already matched (default `normal` on both).
- Single-paragraph (`<p class="bullets-intro">`) and multi-paragraph (`<div class="bullets-intro"><p>…`) cases both covered.
- Bullet list functionality untouched.

## Push
Committed only `index.html` (`56a8161`) → blog-builder `origin/master`.
