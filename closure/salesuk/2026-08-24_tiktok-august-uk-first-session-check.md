## Purpose
Close out the TikTok August UK first-session sales question.

## Summary
Kuberan asked whether any August UK sales came from TikTok (paid or organic first-session). Built a temporary read-only diagnostic endpoint, checked both a tiered paid-evidence classifier and an independent raw substring scan across all first-session data. Answer: zero TikTok presence in 2,378 valid August orders; 75 orders have no journey data and are genuinely unattributable either way.

## Evidence
See `evidence/salesuk/2026-08-24_tiktok-august-uk-first-session-check.md`

## Validation
See `validation/salesuk/2026-08-24_tiktok-august-uk-first-session-check.md`

## Status
PASS.

## Reviewer
Kuberan

## Next step
None — question answered. The diagnostic endpoint (`fn=tiktok-aug-uk-check`) remains in `api/requirement.js` for reuse if needed again.
