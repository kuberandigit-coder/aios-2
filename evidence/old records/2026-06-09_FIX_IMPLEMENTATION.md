# Fix Implementation — Mobile Image Height

**File:** `index.html`  
**Changes:** 2 lines  
**Risk:** Minimal — matches the pattern used by all working image types  
**Date:** 2026-06-09

---

## Fix Strategy

Change both broken lines from `_inlineStyles.push(...)` to `h +=` (direct HTML injection).

This matches exactly how `imageonly` pair/triple and `imgtxt` handle mobile styles — all of which work correctly. It is the simplest, safest, most consistent fix.

---

## Fix 1 of 2 — `section` block, single image

**File:** `index.html`  
**Line:** 7941

### Before
```javascript
var siMH = b.imgHM || 200;
_inlineStyles.push('<style>@media(max-width:768px){#simg-' + b.id + '{height:' + siMH + 'px !important;}}</style>');
```

### After
```javascript
var siMH = b.imgHM || 200;
h += '<style>@media(max-width:768px){#simg-' + b.id + '{height:' + siMH + 'px !important;}}</style>\n';
```

**What changed:** `_inlineStyles.push(...)` → `h +=`  
**Why it works:** The style tag is written directly into the HTML output string, guaranteeing it appears in both the preview iframe and the exported HTML, before the `<img>` it targets.

---

## Fix 2 of 2 — `imageonly` block, single image

**File:** `index.html`  
**Line:** 8176

### Before
```javascript
var siMH = b.imgHM || 200;
_inlineStyles.push('<style>@media(max-width:768px){#simg-' + b.id + '{height:' + siMH + 'px !important;}}</style>');
```

### After
```javascript
var siMH = b.imgHM || 200;
h += '<style>@media(max-width:768px){#simg-' + b.id + '{height:' + siMH + 'px !important;}}</style>\n';
```

**What changed:** `_inlineStyles.push(...)` → `h +=`  
**Why it works:** Same reason as Fix 1. Direct injection into the HTML string.

---

## Why This Fix Is Safe

| Concern | Assessment |
|---------|-----------|
| Breaks desktop height | No — desktop height is on the inline `style` attribute, untouched |
| Breaks pair/triple images | No — those lines are not changed |
| Breaks imgtxt layout | No — that block is not changed |
| Breaks export | No — `h` is the same HTML string used in both preview and export |
| Causes duplicate styles | No — each block has a unique `b.id`, so each `#simg-{id}` selector is unique |
| Affects CSS specificity | No — `!important` is already present, matching all other mobile overrides |

---

## No Other Changes Needed

- `imgHM` is already saved correctly when the slider changes (`onIn(id, 'imgHM', value)`)
- `siMH = b.imgHM || 200` already reads the value correctly
- The CSS selector `#simg-{id}` already matches the `<img id="simg-{id}">` element
- The media query `@media(max-width:768px)` is the correct breakpoint used throughout

The only broken link in the chain was the output method. Both fixes resolve that with a one-word change per line.
