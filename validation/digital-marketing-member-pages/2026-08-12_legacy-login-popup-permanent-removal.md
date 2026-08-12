# Validation — Legacy Login-Popup Permanent Removal (2026-08-12)

**Purpose:** Validation record for `evidence/digital-marketing-member-pages/2026-08-12_legacy-login-popup-permanent-removal.md`.

## Checks performed
- Confirmed the old auth-overlay HTML/JS block is fully absent (not just hidden) from all 6 files via source inspection.
- Confirmed repeated hard-refreshes on each of the 6 pages show no popup flash.
- Confirmed `eod.html`'s Home link now uses a relative path, not the flagged `.vercel.app` domain.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
