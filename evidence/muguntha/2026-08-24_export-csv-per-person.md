## Purpose
Add a per-person Export CSV button to the muguntha.html Performance tab.

## Business Question
Kuberan: "need export csv button for per person to download".

## Fix
Added an "Export CSV" button to all 6 filter bars (Sonya, Sajeepan, Kamsi, Dilaksi, Jefri, Sukirtha) and Thasitha's separate single-year panel. Each button downloads whatever's currently rendered on screen for that member (via a new `LATEST_PERF_ROWS` cache populated on every render) — no extra server round-trip. Two CSV shapes: the standard 2025-vs-2026 dual-year shape, and Thasitha's simpler single-year shape.

## Files Modified
- `pages/muguntha.html`

## Status
PASS — deployed to production, live-verified the button/function markup is present.

## Reviewer
Kuberan
