# Evidence — SECURITY: seo.html / organic-revenue.html Missing Auth Guard (2026-08-11)

**Purpose:** Record of a real unauthenticated-access security gap found and fixed same-day.

## Root cause
Both `seo.html` (SEO Intelligence) and `organic-revenue.html` were gathered from Piranav's Staff-requirements-02 project on 2026-08-11 (`d58d346`) and had the standard `dm_session` auth guard inserted automatically by a script, matching the pattern used on every other page in this project. The insertion script's regex assumed no content between `<title>` and `<style>` — but both files have a `<script src="chart.js">` tag in between, which the regex didn't account for. The guard was therefore silently never inserted into either file.

## Impact
Anyone with the URL to either page could load it fully unauthenticated — no login required, no session check, full page content and data visible.

## Fix (`834bf9f`)
Caught via manual audit the same day. Fixed by inserting the standard `dm_session` guard block after the `chart.js` `<script>` tag instead of assuming it comes immediately after `<title>`.

## Files touched
- `reports/digital-marketing-member-pages/pages/seo.html`
- `reports/digital-marketing-member-pages/pages/organic-revenue.html`

## Deployment
Deployed to production same day, verified live (both pages redirect to login when unauthenticated).

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** Recommend auditing any other pages gathered via the same automated insertion script for the same regex gap, if more are added later — none found beyond these two as of this date.
