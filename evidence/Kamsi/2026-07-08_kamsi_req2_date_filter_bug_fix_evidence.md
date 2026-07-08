# Evidence — Kamsi Req2: Fixed Bug Where Selecting a Date Did Nothing

**Title:** Fixed a real bug where the date-picker's `onchange` never actually changed the displayed data
**Purpose:** User-reported: "when i select a date there are no any changes why ?"
**Requirement Source:** User bug report, 2026-07-08
**Team Member:** Kamsi (SEO team) · **Reviewer:** Kuberan

## Root cause
During an earlier patch (adding the calendar day-filter), the edit script located `flt()`'s body via the exact string `F=D.filter(function(r){` to inject the day-filtering logic (`var base2=dayBase(curDay2); F=base2.filter(...)`). This string is **not unique** — Req1 (a completely different tab/panel) has its own, differently-scoped `flt()` function that happens to share the identical line. The replace (with `count=1`) matched **Req1's occurrence first** (it appears earlier in the document), not Req2's:

- **Req1's `flt()`** got the day-filter code injected by mistake — referencing `dayBase`/`curDay2`/`DAY`, none of which exist in Req1's scope. This would throw a `ReferenceError` the moment Req1's search/filter was used.
- **Req2's real `flt()`** — the one actually wired to the date-picker's `onchange` — was left completely unmodified, still filtering from the raw monthly dataset (`D`) regardless of which date was selected. This is exactly why selecting a date visibly did nothing: the correct function (`pickDay2` → `flt()`) ran, `curDay2` was set correctly, but Req2's own `flt()` never read `curDay2` at all.

## Fix
- Reverted Req1's `flt()` to its original, correct form (`F=D.filter(...)`, no `dayBase` reference).
- Added the missing `var base2=dayBase(curDay2); F=base2.filter(...)` to Req2's actual `flt()` function.

## Verification performed (this time with a real functional simulation, not just syntax check)
- `node --check` on the full script: passed, exit 0
- **Built a Node.js harness with a minimal DOM mock** (`getElementById`, `textContent`, `value`), loaded Req2's exact IIFE plus its real `d2`/`d2day` JSON payloads, and actually called `pickDay2('')` then `pickDay2('2026-06-05')` in sequence
- Confirmed the rendered table HTML **differs** between "Full Month" and "2026-06-05" — for the top page (`/blogs/new/b22-bayonet-bulbs-explained...`), impressions dropped from **26,370 (month total)** to **634 (single day)**, confirming the filter genuinely recomputes per-day
- Live deployment fetch confirmed both `flt()` functions are now correct in production

## Files created/modified
- `reports/digital-marketing-member-pages/pages/kamsi-req1-slow-moving-products.html`
- `reports/Kamsi/data/2026-07-08_kamsi_before_flt_bug_fix_backup.html` — safety backup before this fix

## Deployment
Deployed to Vercel production and verified live (HTTP 200), both `flt()` functions confirmed correct.

**Duplicate risk:** GREEN
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Live, confirmed working via functional simulation (not just visual inspection)
**Known Limitations:** None
**Next Steps:** none — recommend Kamsi re-test the date picker directly to confirm on her end
**PASS / FAIL:** PASS
