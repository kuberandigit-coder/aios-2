# New Section Implementation — ImgList Block

**Project:** Blog Builder (`index.html`)  
**Date:** 2026-06-09  
**Status:** Complete — all 8 changes applied

---

## What Was Built

A new block type called `imglist` was added to Blog Builder.  
It renders a **3-column layout**: two stacked images on the left, a numbered list with sub-bullets in the centre, and two stacked images on the right.

---

## All 8 Changes Applied

| # | Change | Location in index.html |
|---|--------|------------------------|
| 1 | Sidebar add button | Line 3355 |
| 2 | `addBlock()` default values | Line 4410 |
| 3 | Insert menu entry | Line 4484 |
| 4 | Title ternary chain entry | Line 6666 |
| 5 | Helper functions (6 functions) | After `delReviewItem` |
| 6 | Settings panel HTML | Line 7546 |
| 7 | CSS in `buildCSS` | Lines 7955–7966 |
| 8 | HTML rendering in `buildBody` | Lines 8334–8369 |

---

## Data Model

```javascript
{
  type: "imglist",
  heading: "Types of Products",
  imgTL: "",   // top-left image URL
  imgBL: "",   // bottom-left image URL
  imgTR: "",   // top-right image URL
  imgBR: "",   // bottom-right image URL
  imgH: 200,   // desktop image height (px)
  imgHM: 150,  // mobile image height (px)
  bgColor: "", // optional background colour
  items: [
    {
      title: "Item One",
      bullets: ["First benefit.", "Second benefit."]
    }
  ]
}
```

---

## Helper Functions Added

```javascript
addImgListItem(id)                        // add new item row
delImgListItem(id, idx)                   // delete item row
onInImgListItem(id, idx, val)             // update item title
addImgListBullet(id, idx)                 // add sub-bullet to item
delImgListBullet(id, idx, bi)             // delete sub-bullet
onInImgListBullet(id, idx, bi, val)       // update sub-bullet text
```

---

## CSS Classes

| Class | Purpose |
|-------|---------|
| `.imglist-block` | 3-col grid container |
| `.imglist-imgs` | Flex column for stacked images |
| `.imglist-content` | Centre text column |
| `.imglist-heading` | Section heading |
| `.imglist-items` | Numbered list (`counter-reset`) |
| `.imglist-item` | Single numbered item |
| `.imglist-item-title` | Item title with auto counter before |
| `.imglist-bullets` | Sub-bullet `<ul>` |

---

## Mobile Behaviour

- Grid collapses to **single column** at `max-width:768px`
- Images go side-by-side (row-wrap) instead of stacked
- Mobile image height applied via inline `<style>` tag injected into HTML output (same pattern as fixed single-image blocks)
