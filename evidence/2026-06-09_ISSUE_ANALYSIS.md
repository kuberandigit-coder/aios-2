# Issue Analysis — Mobile Image Height Not Working

**Project:** Blog Builder (`index.html`)  
**Date:** 2026-06-09  
**Status:** Root cause confirmed from code

---

## Root Cause — Confirmed

The mobile height style is being pushed into a **dead array** (`_inlineStyles`) that is **never read back and never output to the HTML**.

The correct array is `_inlineStylesCollector`, which IS read back and merged into the CSS output. The wrong array `_inlineStyles` simply collects styles silently and discards them.

---

## Evidence

### The Two Arrays

| Array | Defined At | Read/Output At | Status |
|-------|-----------|----------------|--------|
| `_inlineStylesCollector` | line 7900 | lines 8452, 8608 | ✅ Working — output to HTML |
| `_inlineStyles` | line 7908 | **Never** | ❌ Dead — styles are lost |

### Where `_inlineStylesCollector` is consumed (works correctly)

**Line 8452 — preview render:**
```javascript
var _extraCSS = _inlineStylesCollector.map(function(s){
  return s.replace(/<\/?style[^>]*>/g,'');
}).join('');
// → merged into <style> tag in the preview HTML
```

**Line 8608 — export/doc build:**
```javascript
var _extraCSS = _inlineStylesCollector.map(function(s){
  return s.replace(/<\/?style[^>]*>/g,'');
}).join('');
// → merged into exported article CSS
```

### Where the bug is — `_inlineStyles` is used instead

**Line 7941 — `section` block, `imageType === "single"`:**
```javascript
_inlineStyles.push(
  '<style>@media(max-width:768px){#simg-' + b.id +
  '{height:' + siMH + 'px !important;}}</style>'
);
// ❌ Pushed into _inlineStyles — never output — mobile height silently lost
```

**Line 8176 — `imageonly` block, `imageType === "single"`:**
```javascript
_inlineStyles.push(
  '<style>@media(max-width:768px){#simg-' + b.id +
  '{height:' + siMH + 'px !important;}}</style>'
);
// ❌ Same bug — pushed into dead array
```

---

## Comparison: Broken vs Working Implementations

### ❌ Single Image (BROKEN) — line 7941
```javascript
var siMH = b.imgHM || 200;
_inlineStyles.push(                          // ← wrong array, never output
  '<style>@media(max-width:768px){#simg-' + b.id +
  '{height:' + siMH + 'px !important;}}</style>'
);
```

### ✅ Pair Image (WORKING) — line 7951
```javascript
var pairMH = b.pairHM || 160;
_inlineStylesCollector.push(                  // ← correct array, IS output
  '<style>@media(max-width:768px){#pair-' + b.id +
  ' img{height:' + pairMH + 'px !important;}}</style>'
);
```

### ✅ Triple Image (WORKING) — line 7971
```javascript
var triMH = b.tripleHM || 140;
_inlineStylesCollector.push(                  // ← correct array, IS output
  '<style>@media(max-width:768px){#tri-' + b.id + '...}</style>'
);
```

### ✅ imageonly pair (WORKING) — line 8185
```javascript
h += '<style>@media(max-width:768px){...}</style>';  // ← direct inject, always works
```

### ✅ imgtxt (WORKING) — line 8226
```javascript
h += '<style>@media(max-width:768px){...}</style>';  // ← direct inject, always works
```

---

## Why Desktop Height Works Fine

Desktop height is applied as an inline style directly on the `<img>` tag:

```javascript
var siStyle = "width:" + (b.imgW||100) + "%;height:" + (b.imgH||400) + "px;...";
var si = '<img id="simg-' + b.id + '" style="' + siStyle + '" ...>';
```

Inline styles are always written directly into `h` (the HTML string) and always output. That's why desktop height works — it never goes through either array.

---

## Affected Image Types

| Image Type | Block Type | Mobile Height Bug |
|------------|-----------|-------------------|
| Single image | `section` | ❌ Bug — line 7941 |
| Single image | `imageonly` | ❌ Bug — line 8176 |
| Pair images | `section` | ✅ Works — line 7951 |
| Triple images | `section` | ✅ Works — line 7971 |
| Pair images | `imageonly` | ✅ Works — line 8185 |
| Triple images | `imageonly` | ✅ Works — line 8196 |
| Image+Text | `imgtxt` | ✅ Works — line 8226 |

---

## Summary

- **Setting saved correctly:** ✅ `imgHM` is stored in the block data
- **Setting passed to renderer:** ✅ `siMH = b.imgHM || 200` is read correctly
- **CSS generated correctly:** ✅ The style string is correct
- **CSS output to HTML:** ❌ **FAILS** — pushed to dead `_inlineStyles` array instead of `_inlineStylesCollector`
- **Override by desktop styles:** Not the cause (this would be a specificity issue — the real issue is the style never reaches the DOM at all)
