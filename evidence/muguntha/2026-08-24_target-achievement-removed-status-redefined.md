## Purpose
Remove the Target Achievement column from all Performance tabs and redefine the Status column as Achieved (YoY Growth ≥ 30%) / Not Achieved (< 30%) / N/A.

## Business Question
Kuberan (with a screenshot of the Target Achievement column): "remove this coloum from all no need that and when yoy growth is less than 30% show in status not achived when 30 and above 30 is achided fox for all".

## Fix
- Removed the `Target Achievement` `<th>` and its `<td>` cell from all 6 dual-year tables (Sonya/Sajeepan/Kamsi/Jefri/Dilaksi/Sukirtha), reduced `colspan` from 13 to 12 throughout.
- Removed the `targetAch` calculation entirely from `buildPerfRows()` (no longer needed — was `2026 Net ÷ (2025 Net × 1.30)`).
- Replaced the old Not-Archived/Archived Status pill (based on `isLive`) with a new `statusPillFor()` derived from `yoyGrowth`: `>= 0.30` → "Achieved" (green pill), `< 0.30` → "Not Achieved" (red pill), `null` → "N/A".
- Updated CSV export (header + row values) to match.
- Updated all 6 methodology footnotes and the Thasitha panel's own footnote (she has no YoY concept, footnote updated to reflect the removed column correctly).

## Files Modified
- `pages/muguntha.html`

## Status
PASS — deployed to production, live-verified `Target Achievement` column markup is gone and `statusPillFor` logic is present.

## Reviewer
Kuberan
