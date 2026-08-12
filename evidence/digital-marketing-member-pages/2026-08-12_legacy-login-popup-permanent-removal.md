# Evidence — Legacy Login-Popup Permanent Removal (2026-08-12)

**Purpose:** Record of a recurring UI bug fix: Piranav's pre-merge standalone login-overlay popup flashing briefly on page load.

## Root cause
The old standalone login-overlay (pre-dating the unified `dm_session` login system, from Piranav's original 6 pages) was still physically present in the HTML on `sonya.html`, `sajeepan.html`, `theekshy.html`, `thivajini.html`, `hetheesha.html`, `jakshan.html` after the 2026-08-11 merge/redesign. It was only hidden by out-of-band JS unrelated to the real async `dm_session` auth guard, so on first paint (before that JS ran) the old popup would flash visibly — reported by the user via screenshot, with a browser-autofilled username visible in the flash.

## Fix (`6d5c755`)
Per explicit instruction to fix "permanently" (not just hide it further), the overlay HTML/JS blocks were physically deleted from all 6 files.

## Same commit, unrelated fix bundled in
`eod.html`'s "Home" sidebar link was hardcoded to the old flagged `.vercel.app` domain instead of a relative path — fixed in the same commit.

## Files touched
- `reports/digital-marketing-member-pages/pages/{sonya,sajeepan,theekshy,thivajini,hetheesha,jakshan}.html`
- `reports/digital-marketing-member-pages/pages/eod.html`

## Deployment
Deployed to production, verified live — no flash on repeated page loads/refreshes.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
