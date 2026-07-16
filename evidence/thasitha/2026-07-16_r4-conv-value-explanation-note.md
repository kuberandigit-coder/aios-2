# Evidence — Thasitha Requirement 4: Added explanation note for Conv.Value vs Google Ads Products tab

**Date:** 2026-07-16

## Purpose
User compared dashboard SKU `CRSF100BM+PHSH1PBRYB+SCRN70BM+LSDO210BG-IDE` (pid `45607454834953`) against Google Ads' Products tab and found the dashboard's Conv.€ higher than what Google's Products report shows for that item. Investigated root cause with SKU `56271176597769` as a worked example (Google's Products tab has 13 feed-label rows for that item; the THT campaign's €16.14 conversion doesn't appear under any of them because Google's Products report pivots by current feed label, and a product's feed-label tag can change over time, orphaning older campaign history from that view). Our dashboard reads raw per-campaign performance data directly, so it doesn't lose that history.

## Change
Added one short plain-language sentence to the R4 status note, directly under the existing Conv. Value definition:
"Why this figure can be higher than Google Ads' Products tab: Google's Products report groups rows by the product's current feed label, so if a product's feed-label tag changed at any point, older conversions tied to the old label become invisible in that report — even though they really happened. Our number is pulled directly from Google's raw per-campaign performance data, so it stays complete and won't drop older history like that."

## Validation
- Text-only change (no data/logic touched). Both `<script>` blocks pass `new Function(...)` syntax check.

## Status
PASS. Deployed to production.
