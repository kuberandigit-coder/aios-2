# Validation — DC Voltage E27 "Next Level" Quick Fixes

**Date:** 2026-10-02
**Reviewer:** Kuberan (live screenshots in-session) + 2 items independently confirmed live
by direct page fetch
**Purpose:** Confirm all 9 quick-fix items due today are genuinely live/approved, not just
edited locally.

## Checks performed

| # | Item | Method | Result |
|---|------|--------|--------|
| 1 | P5 meta description saved | Screenshot: Shopify admin, saved field, "Product saved" toast | PASS, Thuwaraga approved |
| 2 | G2 meta description saved | Screenshot: Shopify admin, 144/160 characters, matches approved text exactly | PASS |
| 3 | P2 FAQ 1 link fixed | Screenshot: live storefront page, "B22 version of this bulb" renders as a clean link, no raw URL/arrow text | PASS, Thuwaraga approved |
| 4 | C3 FAQ 2 link + intro line breaks | Screenshots of both parts on the duplicate theme ("Tinker - E27 model DRAFT"), "Changes saved" confirmation visible | PASS on draft theme — **pending Muguntha's approval to publish to live theme** |
| 5 | G1 — 3 dead links fixed | Draft-theme screenshot, THEN independently re-checked via a direct fetch of the real public guide page (not the draft) — confirmed `/collections/e27-bulbs` and `/collections/led-bulb` both present and correct in the live HTML | PASS, confirmed live |
| 6 | G3 — duplicate H1 removed | Independently re-checked via direct fetch of the real public guide page's heading structure — exactly one `<h1>` tag found, hero text no longer appears as any heading level | PASS, confirmed live |
| 7 | C4 — sold-out products reordered | Screenshot: Shopify admin collection manual-sort list, ~1116 and ~1226 at positions 16/17 of 17 | PASS |
| 8 | C1a — menu nesting | First attempt caught as wrong (sibling item, not nested) via screenshot review before saving; corrected attempt confirmed properly indented before save, then confirmed live via a clean storefront screenshot (no duplicate top-level item) | PASS, confirmed live |
| 8 | C1b — LED Bulb page link | Screenshot: live storefront LED Bulb collection page showing the new link rendered correctly | PASS, confirmed live |
| 8 | C1c — guide E27 button | Already correct prior to this task, reconfirmed via the same live fetch used for G1 | PASS |
| 9 | P1 — description rewrite | Screenshot: Shopify admin, new text saved exactly matching the approved intro, "Installation & Safety" preserved below it, "Product saved" toast | PASS, Thuwaraga approved |

## Independent verification method used (items 5 and 6)

For G1 and G3, rather than relying only on the draft-theme screenshot, the real public guide
page was fetched directly (`https://dcvoltage.co.uk/blogs/news/e27-vs-b22-vs-gu10-...`) and
its actual served HTML inspected for: every link's `href` pointing to a collections page, and
the full `<h1>`/`<h2>` heading list in document order. Both confirmed correct against the
live, publicly-served page — a stronger check than a theme-preview screenshot alone, since it
rules out "looks right in the editor but isn't actually published" as a failure mode.

## Gaps / not independently re-verified

- C3 is confirmed correct **on the draft theme only** — not yet published to the live theme,
  pending Muguntha. Do not treat this as "done" until the publish step happens and is
  re-confirmed.
- The exact wording check for P1/P2/P5 (does the saved text match the approved text
  character-for-character) was done by visual comparison of the screenshot against the
  approved text, not an automated diff.

## Verdict

**PASS** on 8 of 9 items with live confirmation (G1, G3, C1 independently re-verified against
the real public page rather than just the draft theme or an admin-panel screenshot). **C3
PASS on the draft theme, publish step outstanding** — the one open item carried forward.
