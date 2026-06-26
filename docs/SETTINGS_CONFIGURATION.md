# Settings Configuration — ImgList Block

**Project:** Blog Builder (`index.html`)  
**Date:** 2026-06-09

---

## Settings Panel Fields

When a user adds an ImgList block and opens its settings panel, the following controls appear:

### 1. Heading
- **Type:** Text input  
- **Placeholder:** `Section heading...`  
- **Saves to:** `b.heading`  
- **Rendered as:** `<h2 class="imglist-heading">` in the output

---

### 2. Images — 4 URL Inputs

| Field | Saves to | Position |
|-------|----------|----------|
| Top-left image URL | `b.imgTL` | Left column, top |
| Bottom-left image URL | `b.imgBL` | Left column, bottom |
| Top-right image URL | `b.imgTR` | Right column, top |
| Bottom-right image URL | `b.imgBR` | Right column, bottom |

All fields are `type="url"` inputs. Images not provided are simply not rendered.

---

### 3. Desktop Height Slider

- **Type:** Range slider  
- **Min:** 80px | **Max:** 500px | **Step:** 10px  
- **Default:** 200px  
- **Saves to:** `b.imgH`  
- **Applied as:** `style="height:{b.imgH}px"` on each `<img>`

---

### 4. Mobile Height Slider

- **Type:** Range slider  
- **Min:** 60px | **Max:** 400px | **Step:** 10px  
- **Default:** 150px  
- **Saves to:** `b.imgHM`  
- **Applied as:** `@media(max-width:768px){#imglist-{id} .imglist-imgs img{height:{b.imgHM}px !important;}}`  
- Injected as an inline `<style>` tag directly in the HTML output

---

### 5. List Items Editor

Each item has:
- **Title input** — saves to `b.items[i].title`
- **Sub-bullet inputs** — saves to `b.items[i].bullets[j]`
- **+ sub-bullet button** — calls `addImgListBullet(id, i)`
- **✕ button** on each sub-bullet (if more than 1) — calls `delImgListBullet(id, i, j)`
- **✕ button** on each item (if more than 1) — calls `delImgListItem(id, i)`

**+ Add Item button** at the bottom — calls `addImgListItem(id)`

---

## Default State (on addBlock)

```javascript
{
  heading: "Types of Products",
  imgTL: "", imgBL: "", imgTR: "", imgBR: "",
  imgH: 200,
  imgHM: 150,
  bgColor: "",
  items: [
    { title: "Item One",  bullets: ["First benefit or detail.", "Second benefit or detail."] },
    { title: "Item Two",  bullets: ["First benefit or detail.", "Second benefit or detail."] }
  ]
}
```

Two items with two sub-bullets each are created by default so the block looks meaningful immediately without any configuration.
