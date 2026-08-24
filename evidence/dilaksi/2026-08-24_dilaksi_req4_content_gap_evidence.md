## Title
Dilaksi Requirement 4 — SEO Content Gap & AI Search Opportunity Analysis

## Purpose
Build a functional tool on `pages/dilaksi.html` (new Tab 4) letting Dilaksi enter any keyword and get: Semrush search volume, Semrush related questions, Google PAA/AI Overview (or an honest "unable to verify"), LEDSone existing-content match, LLM-style prompt phrasing, and a deterministic recommended action from 6 approved content-gap conditions.

## Date
2026-08-24

## Team Member
Dilaksi

## Team
SEO

## Requirement
4

## Business Question
For a given SEO topic/keyword, is there a content gap on ledsone.co.uk worth acting on, and what's the recommended action?

## Input
Free-text "Topic / Seed Keyword" field — dynamic, no hardcoded example keywords.

## Data Sources
- **SEMrush API source:** live `api.semrush.com`, UK keyword database (`type=phrase_this` for Search Volume, `type=phrase_questions` for Related Questions). Server-side only via `SEMRUSH_API_KEY` env var — never exposed to the browser.
- **Google search source:** none configured (no SERPAPI_KEY or equivalent). PAA Question and AI Overview Present are both returned as `"Unable to verify"` with the limitation documented in the response and on the page — never fabricated, per the requirement's own fallback rule.
- **LEDSone content source:** live first-party Shopify predictive search (`https://ledsone.co.uk/search/suggest.json`), checked across products, collections, blog articles, and pages.

## Business Conditions
The 6 approved content-gap conditions, evaluated in the given order; the first match is the deterministic Recommended Action (order = priority, nothing invented). All matched condition numbers are returned for audit.

## Recommended Action Rules
Mapped exactly as specified (New blog post / Add FAQ block+schema / Priority rewrite for LLM extraction / Monitor / Deprioritize / Add FAQ to existing page) — see `api/requirement.js`'s `CONDITIONS` array in `dilaksiReq4ContentGapModule`.

## Files Created
None (feature added into existing shared files).

## Files Modified
- `api/requirement.js` — new `dilaksiReq4ContentGapModule` IIFE, dispatched via `fn=dilaksi-req4-content-gap`.
- `pages/dilaksi.html` — new Tab 4 (nav link, panel, input/button/loading/error/table UI, JS wiring). Requirements 1-3 left untouched (verified: all 3 `Requirement N — Live/All Collections` headers still present after the edit).

## API/Connector Details
- Endpoint: `GET /api/requirement?fn=dilaksi-req4-content-gap&keyword=<text>`
- Response fields documented in `pages/dilaksi.html`'s "Notes & Methodology" section, including the exact API limitation text for unavailable fields.

## Security Notes
`SEMRUSH_API_KEY` is read server-side only (`process.env.SEMRUSH_API_KEY`), never appears in `dilaksi.html`, browser network requests, logs, or any committed file. Confirmed the key value was never typed or displayed by the assistant at any point — user retrieved and set it themselves in Vercel.

## Evidence Path
This file.

## Validation Result
See `validation/dilaksi/2026-08-24_dilaksi_req4_content_gap_validation.md`.

## Known Limitations
1. **Google PAA / AI Overview**: no SERP-retrieval API configured — always `"Unable to verify"`, documented on-page. This is the requirement's own explicit fallback, not a shortfall.
2. **SEMrush plan limitation** (discovered during testing): the connected Semrush account's plan has 0 Standard API Units and purchasing units requires the Business plan (confirmed via the account's own Subscription Info page, 2026-08-24). Search Volume and Related Questions currently return a documented "Unavailable — Semrush account plan does not include Standard API units" message rather than data or a fabricated value. Per Kuberan's explicit instruction, this was left as a documented limitation rather than escalating to a plan upgrade.

## Next Step
If the Semrush account is upgraded to Business plan in future, Search Volume / Related Questions will start returning real data automatically — no code change needed (the integration and request logic are already confirmed working end-to-end against the real API).

## Owner/Reviewer
Kuberan

## Status
PASS (with a documented, non-fabricated limitation on the Semrush data fields).
