# ImgList Block — Changes Log

**Project:** Blog Builder (`index.html`)  
**Date:** 2026-06-09  
**Status:** All 8 changes applied and complete

---

## Summary of What Changed

A new block type `imglist` was fully implemented in `index.html`.  
It produces a 3-column layout: images left | numbered list centre | images right.

---

## Change 1 — Sidebar Button
**Location:** ~Line 3355

```html
<button class="addbtn add-imglist" onclick="addBlock('imglist')">📷 Img List</button>
```

---

## Change 2 — addBlock() Defaults
**Location:** ~Line 4410

```javascript
else if (type === "imglist") Object.assign(b, {
  heading: "Types of Products",
  imgTL: "", imgBL: "", imgTR: "", imgBR: "",
  imgH: 200, imgHM: 150,
  bgColor: "",
  items: [
    { title: "Item One",  bullets: ["First benefit or detail.", "Second benefit or detail."] },
    { title: "Item Two",  bullets: ["First benefit or detail.", "Second benefit or detail."] }
  ]
});
```

---

## Change 3 — Insert Menu Entry
**Location:** ~Line 4484

```javascript
{ type:'imglist', icon:'📋', label:'Img List' }
```

---

## Change 4 — Title Ternary Chain
**Location:** ~Line 6666

```javascript
b.type === "imglist" ? "ImgList: " + (b.heading || "List").slice(0, 20)
```

---

## Change 5 — Helper Functions
**Location:** After `delReviewItem`

- `addImgListItem(id)`
- `delImgListItem(id, idx)`
- `onInImgListItem(id, idx, val)`
- `addImgListBullet(id, idx)`
- `delImgListBullet(id, idx, bi)`
- `onInImgListBullet(id, idx, bi, val)`

---

## Change 6 — Settings Panel HTML
**Location:** ~Line 7546 (before review block settings)

Fields: heading input, 4 image URL inputs, desktop height slider, mobile height slider, repeatable items editor with per-item title + sub-bullets.

---

## Change 7 — CSS in buildCSS
**Location:** ~Lines 7955–7966 (after imgtxt CSS, before RESPONSIVE comment)

Classes added:
- `.imglist-block` — 3-col grid
- `.imglist-imgs` — flex column for stacked images
- `.imglist-content` — centre column
- `.imglist-heading` — section heading style
- `.imglist-items` — numbered list with CSS counter
- `.imglist-item` — single item
- `.imglist-item-title` — title with counter::before in accent colour
- `.imglist-bullets` — sub-bullet `<ul>`
- `@media(max-width:768px)` — collapses to 1 column, images go side-by-side

---

## Change 8 — HTML Rendering in buildBody
**Location:** ~Line 8334 (before review rendering)

- Injects inline `<style>` for mobile height override scoped to `#imglist-{id}`
- Renders left images column
- Renders centre heading + `<ol>` with items and `<ul>` sub-bullets
- Renders right images column
- All wrapped in `<div id="imglist-{id}" class="imglist-block">`

---

## Files Modified

| File | Change |
|------|--------|
| `C:\Users\PC\OneDrive\Desktop\Blog tool\index.html` | 8 insertions across the file |

## Documentation Saved

| File | Location |
|------|----------|
| `NEW_SECTION_IMPLEMENTATION.md` | website technical - Kuberan\ |
| `SETTINGS_CONFIGURATION.md` | website technical - Kuberan\ |
| `RESPONSIVE_BEHAVIOR.md` | website technical - Kuberan\ |
| `IMGLIST_CHANGES_LOG.md` | website technical - Kuberan\ |
