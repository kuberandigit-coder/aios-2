# Handover — Alt Text Optimization: image lightbox, count-guessing fix, Copy/Done/Verify tools

Date: 2026-09-22
Owner: (dm-dashboard dev tooling, page used across SEO team)
Reviewer: project owner/team

## What was built

Three fixes to the Alt Text Optimization page (`dev_tasks/alt_text_keywords`),
all from direct user bug reports with screenshot evidence:

1. Click-to-expand image lightbox (thumbnails weren't viewable larger).
2. Fixed a real accuracy bug: AI-generated alt text could state a wrong
   item count (e.g. "two" when the photo shows five) because the
   generator is text-only and got biased by pack-size wording in the
   product title. Added a prompt rule forbidding unverifiable quantity
   claims.
3. Copy / Done / Verify workflow for the disabled auto-write path: Copy
   puts text on the clipboard, Done logs a manual update, Verify Now
   re-checks Shopify's live alt text and reports Verified/Mismatch.

## Files changed

- `backend/app/dev_tasks/alt_text_keywords/ai_alt_text.py` (prompt rule)
- `backend/app/dev_tasks/alt_text_keywords/schema.py` (new columns +
  `mark_manual_update`/`get_log_row`/`set_verification`)
- `backend/app/dev_tasks/alt_text_keywords/shopify_write.py`
  (`get_current_alt_text` — read-only)
- `backend/app/dev_tasks/alt_text_keywords/router.py` (2 new endpoints)
- `frontend/src/admin/pages/dev-tasks/AltTextKeywordFinder.jsx`
- `frontend/src/styles/dashboard.css` (lightbox + button styles)

## New backend endpoints

- `POST /api/dev/alt-text-keywords/mark-manual-update`
- `POST /api/dev/alt-text-keywords/update-history/{log_id}/verify`

## Testing

Live-tested against the real database and real Shopify read API: the
exact real bonsai product from the bug report (3 regenerate runs, no
guessed counts), a full manual-update + verify round trip (real DB rows
created and cleaned up). Frontend build clean.

## Current status

Implemented, live-tested, pushed to `dev-work` only (commits `b2320b3`,
`81f0766`). Deployment not confirmed at time of writing.

## Known limitations

- Verify only checks alt text match; it doesn't confirm the update
  happened via this tool vs. some other route.
- No automated reminder to click Verify after a manual Done — still a
  manual step.

## Next step

Deploy, then spot-check the lightbox/Copy/Done/Verify flow live on a
real product.
