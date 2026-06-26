# Testing Checklist — Mobile Image Height Fix

**File tested:** `index.html`  
**Date:** 2026-06-09

---

## Pre-Testing Setup

- [ ] Make a backup copy of `index.html` before applying the fix
- [ ] Apply both fixes (lines 7941 and 8176)
- [ ] Open `index.html` in Chrome
- [ ] Open DevTools → toggle device toolbar (Ctrl+Shift+M) to simulate mobile

---

## Test 1 — Section Block, Single Image, Mobile Height

**Block type:** `section` with `imageType = "single"`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add a Section block with a single image | Image appears at default height |
| 2 | Set Mobile H slider to 150px | Image height changes to 150px in mobile preview |
| 3 | Set Mobile H slider to 300px | Image height changes to 300px in mobile preview |
| 4 | Set Mobile H slider to 60px (minimum) | Image height changes to 60px in mobile preview |
| 5 | Set Mobile H slider to 500px (maximum) | Image height changes to 500px in mobile preview |
| 6 | Switch preview to Desktop | Image shows desktop height, not mobile height |

---

## Test 2 — imageonly Block, Single Image, Mobile Height

**Block type:** `imageonly` with `imageType = "single"`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add an Image Only block with a single image | Image appears at default height |
| 2 | Set Mobile H slider to 120px | Image height changes to 120px in mobile preview |
| 3 | Set Mobile H slider to 280px | Image height changes to 280px in mobile preview |
| 4 | Switch to mobile preview | Mobile height applied |
| 5 | Switch to desktop preview | Desktop height restored |

---

## Test 3 — Desktop Height Still Works

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set Desktop H to 200px | Desktop preview shows 200px height |
| 2 | Set Desktop H to 600px | Desktop preview shows 600px height |
| 3 | Set Desktop H to 80px | Desktop preview shows 80px height |
| 4 | Switch to mobile | Mobile height is shown, NOT the desktop value |

---

## Test 4 — Desktop and Mobile Heights Are Independent

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set Desktop H = 500px, Mobile H = 100px | Desktop: 500px, Mobile: 100px |
| 2 | Set Desktop H = 200px, Mobile H = 400px | Desktop: 200px, Mobile: 400px |
| 3 | Change Desktop H only | Mobile height unchanged |
| 4 | Change Mobile H only | Desktop height unchanged |

---

## Test 5 — Other Image Types Unaffected

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Section block with pair images — change Mobile H | Pair mobile height still works |
| 2 | Section block with triple images — change Mobile H | Triple mobile height still works |
| 3 | imageonly pair — change Mobile H | Still works |
| 4 | imageonly triple — change Mobile H | Still works |
| 5 | Image+Text block — change Mobile H | Still works |

---

## Test 6 — Responsive Breakpoint

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open exported HTML, resize browser to 800px wide | Desktop height shown |
| 2 | Resize browser to 768px wide | Mobile height kicks in |
| 3 | Resize browser to 767px wide | Mobile height applied |
| 4 | Resize browser to 375px (iPhone) | Mobile height applied |
| 5 | Resize back to 1024px | Desktop height restored |

---

## Test 7 — Export / Published HTML

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set mobile height, click Copy/Export | Exported HTML contains `@media(max-width:768px){#simg-...}` style |
| 2 | Open exported HTML in browser | Mobile height applies at ≤768px |
| 3 | View source of exported HTML | `<style>@media...` tag appears before the `<img>` |

---

## Pass Criteria

- [ ] Mobile H slider changes image height on ≤768px screens
- [ ] Desktop H slider changes image height on >768px screens
- [ ] Both are independent — changing one does not affect the other
- [ ] Pair and Triple mobile heights still work as before
- [ ] Image+Text mobile height still works as before
- [ ] Exported HTML contains the correct `@media` rule for mobile height
- [ ] No JavaScript errors in DevTools console

---

## Rollback

If any test fails, restore `index.html` from the backup made in Pre-Testing Setup.  
The fix is limited to 2 lines — reverting is instant.
