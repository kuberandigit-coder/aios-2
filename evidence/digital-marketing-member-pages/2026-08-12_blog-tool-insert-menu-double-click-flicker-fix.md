# Evidence — Blog Tool: Insert-Menu "+" Button Flicker Fix (2026-08-12)

**Purpose:** Record of a reported bug fix in `blog-tool/index.html`'s block-insertion "+" button.

## Report
User reported that for some users, clicking the "+" button between blog sections shows the block-type picker menu and then immediately closes it — a visible open/close flicker, not present for all users.

## Root cause
`showInsertMenu(idx, btn)` — bound via the button's inline `onclick` — calls `closeInsertMenu()` as its very first line (intentional: closes any other open menu before opening a new one). No other duplicate event binding exists for the `.insert-btn` class (confirmed via full-file search — only one `onclick` binding, no `addEventListener` duplicate). The most plausible explanation for a duplicate open→close sequence within a single perceived click is a near-duplicate `click` event firing twice for the same physical click — a known behaviour on some trackpads/mouse drivers and remote-desktop/RDP sessions. When that happens: click #1 opens the menu; click #2 (the duplicate) re-enters `showInsertMenu()`, whose first line closes the menu that was just opened — producing the exact "opens then instantly closes" symptom, and explaining why it only affects "some users" (device/input-method dependent, not universal).

## Fix
Added a 300ms debounce guard (`_lastInsertMenuClickAt`) at the top of `showInsertMenu()` — a second call within 300ms of the first is ignored rather than re-triggering the open→close cycle. Minor UX tradeoff: intentionally clicking a *different* `+` button within 300ms of closing another is also debounced, but this is a rare interaction pattern compared to the flicker bug it prevents.

## Files touched
- `reports/digital-marketing-member-pages/pages/blog-tool/index.html`

## Deployment
Deployed to production (both `aios-2` and `Staff-requirements`), confirmed JS syntax valid via `node --check` before push.

**Manual Verification Required:** the exact duplicate-click-event root cause could not be reproduced live in this session (static code analysis only, no access to the affected users' devices/browsers) — the fix targets the most plausible and well-supported cause found. If the flicker persists after this fix for the same users, the root cause is something else and needs live debugging (browser console/network on an affected device).

**Status:** FIX DEPLOYED — awaiting user confirmation the flicker is resolved for affected users
**Reviewer:** Muguntha (pending review)
**Next step:** Confirm with the affected users whether the flicker is gone after a hard refresh.
