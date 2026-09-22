# Evidence — Alt Text Optimization: image lightbox, count-guessing fix, Copy/Done/Verify tools

Date: 2026-09-22
Repo: dm-dashboard (dev_tasks/alt_text_keywords), pushed to `dev-work` only

## User reports handled (in order)

1. Image thumbnails on the Alt Text page couldn't be viewed larger.
2. A real product's AI-generated alt text falsely stated an item count
   ("Two small artificial bonsai trees...") that didn't match the actual
   photo (5 pots pictured), and regenerating never fixed it.
3. The write-to-Shopify path is disabled, so users manually copy/paste
   generated text into Shopify — but there was no way to log that or
   verify it actually took effect.

## Fix 1 — Image lightbox

Click any thumbnail (per-image table + update-history table) to open it
centered, larger, with a close button (click backdrop / × / Escape to
close). Reused the existing `.jreq-modal-overlay`/`.jreq-modal-close`
pattern already used elsewhere in the dashboard; added
`.jreq-modal-image-box` sized to fit the image.

## Fix 2 — Count-guessing bug (root cause confirmed, not just patched)

`ai_alt_text.py` is explicitly TEXT-ONLY (no vision/image analysis —
declined earlier per instruction). The product title "...2 Pack ~5381"
biased the model to always say "two" regardless of what the actual photo
showed. Fix: added an explicit prompt rule forbidding a specific
quantity claim unless confirmed in the product's known attributes.
Live-tested against the exact real product from the report, 3 runs, no
guessed counts in any output; keyword-assignment behavior unaffected.

## Fix 3 — Copy / Done / Verify

- Styled Copy + Done buttons next to each image's Regenerate button.
  Copy puts the AI text on the clipboard. Done logs it as a manual
  update (`status='manual_done'`, `source='manual'`, unverified).
- Update History table gained a Verified column + inline "Verify Now"
  button (`POST /update-history/{id}/verify`) — re-fetches the image's
  CURRENT live alt text from Shopify (read-only, reuses the existing
  broad-read token) and compares it to what was logged, showing
  Verified/Mismatch (and the real live text on mismatch).
- Every history row is now clickable, opens a full detail modal with its
  own Verify Now/Re-check button.
- DB migration: `source`, `verified`, `verified_at`, `verified_by`,
  `live_alt_text` columns added to `alt_text_update_log`
  (migration-safe).

Live-tested `mark_manual_update()`/`set_verification()` end-to-end
against the real database; test row cleaned up afterward.

## Status

Implemented, live-tested, pushed to `dev-work` (commits `b2320b3`,
`81f0766`). Not confirmed deployed at time of writing.
