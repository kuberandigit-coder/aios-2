# Responsive Behaviour — ImgList Block

**Project:** Blog Builder (`index.html`)  
**Date:** 2026-06-09

---

## Desktop Layout (> 768px)

```
┌──────────────┬──────────────────────────┬──────────────┐
│  Top-Left    │                          │  Top-Right   │
│    Image     │   Heading                │    Image     │
│              │                          │              │
│  Bottom-Left │   1. Item Title          │  Bottom-Right│
│    Image     │      • Sub-bullet        │    Image     │
│              │      • Sub-bullet        │              │
│              │                          │              │
│              │   2. Item Title          │              │
│              │      • Sub-bullet        │              │
└──────────────┴──────────────────────────┴──────────────┘
```

- **Grid:** `grid-template-columns: 1fr 1.2fr 1fr`  
- The centre column is slightly wider (1.2fr) to give the text more room  
- Images are stacked vertically in each side column  
- Image height is controlled by the **Desktop H** slider (`b.imgH`)

---

## Mobile Layout (≤ 768px)

```
┌────────────────────────────────┐
│  Top-Left Image | Top-Right    │  ← images side-by-side (50% each)
│  Bottom-Left   | Bottom-Right  │
├────────────────────────────────┤
│  Heading                       │
│  1. Item Title                 │
│     • Sub-bullet               │
│  2. Item Title                 │
│     • Sub-bullet               │
├────────────────────────────────┤
│  (right-column images hidden   │
│   or shown below, flex-wrap)   │
└────────────────────────────────┘
```

- **Grid collapses** to `grid-template-columns: 1fr` — full width single column  
- Images switch from `flex-direction:column` to `flex-direction:row; flex-wrap:wrap`  
- Each image takes `flex: 1 1 45%; max-width: 50%` — two per row  
- Image height is controlled by the **Mobile H** slider (`b.imgHM`)

---

## CSS Breakpoint

```css
/* Desktop */
.imglist-block {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 20px;
  align-items: start;
}

.imglist-imgs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Mobile */
@media (max-width: 768px) {
  .imglist-block {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .imglist-imgs {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .imglist-imgs img {
    flex: 1 1 45%;
    max-width: 50%;
  }
}
```

---

## Mobile Height Override

The mobile height is injected as an inline `<style>` tag at the start of the block HTML:

```html
<style>
@media(max-width:768px){
  #imglist-{id} .imglist-imgs img {
    height: {imgHM}px !important;
  }
}
</style>
```

This approach guarantees the style:
- Appears in the **preview iframe**
- Appears in the **exported HTML**
- Uses `!important` to override the desktop inline style
- Is scoped to this specific block via the `#imglist-{id}` ID prefix

---

## Numbered List — Auto Counter

Numbers are generated using CSS `counter()`, not hardcoded in the HTML:

```css
.imglist-items {
  counter-reset: imglist-counter;
}
.imglist-item {
  counter-increment: imglist-counter;
}
.imglist-item-title::before {
  content: counter(imglist-counter);
  font-size: (base + 4)px;
  font-weight: 900;
  color: accent-colour;
}
```

This means adding or removing items always keeps numbers correct without re-rendering.
