## Purpose
Document dm-dashboard commits for 2026-09-14, recovered from the `dm-dashboard` GitHub repo (`dev-work` branch).

## Certainty
VERIFIED (commit existence) / SUPPORTED (business intent, inferred from commit messages).

## Summary (16 commits)
- **AI/GEO Visibility Gap Analysis (new dev task)**: added `841d17e`; live-updating results table + All Results tab + wired into User Access Management `e461736`; Gemini brand-mention check (Semrush-style) added `f9729a2`, then replaced with Semrush-style query variations `e766d61`; manual Claude-in-Chrome submission endpoint for AI Overview results added `e462cc1`, then **removed again same day** in favor of an automated approach `083d9a1`; detection switched from Search Console to SearchAPI.io for AI Overview `52f1b6f`; UI redesigned to match Dilaksi's style `c324c43`, then **reverted back to table-based layout** same day `ccf8952`; delete-result option + SearchAPI.io remaining-credits display added `5aa7fbe`; checkbox bulk-select/bulk-delete added to All Results view `9a1ba35`; cleaned up AI Overview text for queries with embedded Shopping carousels `3aa6608`; All Results table sorted by most recently checked first `5569f0a`; support for up to 5 SearchAPI.io keys with automatic quota-based switching `4824082`; SearchAPI.io credit balance shown as a prominent KPI card `866a2b3`.
- **Mahima Req4**: Export CSV button moved to the filter toggle row `b2206f4`.

## Notes
Two same-day build-then-revert cycles within this one feature (Claude-in-Chrome manual submission added then removed; UI redesign applied then reverted) — consistent with the pattern already seen elsewhere in this project (API Health Monitor, deploy button) of rapid iteration under direct user feedback rather than upfront design lock-in.

## Files / Areas
AI/GEO Visibility Gap Analysis (major new feature, ~14 commits), Mahima Req4 minor UI change.

## Status
VERIFIED (commit existence) / SUPPORTED (business intent). Retroactive documentation, no live-test evidence recovered.

## Evidence
`dev-work` branch commits `b2206f4`..`841d17e` dated 2026-09-14.

## Reviewer
Pending — Kuberan

## Next step
None required unless deeper per-feature evidence is wanted.
