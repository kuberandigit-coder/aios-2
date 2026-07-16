# Evidence — Thasitha Requirement 2: Remove Link column, make product title clickable

**Date:** 2026-07-16
**File:** `reports/digital-marketing-member-pages/pages/thasitha.html`
**Purpose:** User requested the separate "Link" column in the R2 (PMax Product Zero-Performance) table be removed, with the Product Title cell itself becoming the clickable link instead.

## Changes made

1. Removed `<th>Link</th>` header from the R2 table (`tabPanelR2`).
2. Removed the `linkCell` variable and its `<td>` from the R2 row-render function (`renderR2()`).
3. Replaced the plain title `<td>` with a `titleCell` that renders `r.title` wrapped in `<a class="t2-title-link" href="r.lnk" target="_blank" rel="noopener">` when a link exists, or plain escaped text when it doesn't (same fallback logic the old Link column used).
4. Added CSS `.t2-title-link` (inherits text color, underline+accent-color on hover) so the title doesn't look like a generic link chip.
5. Confirmed R3 (`o.lnk`/`linkCell` at lines ~1019/1081, `<th>Link</th>` at line ~499) was untouched — R3 keeps its own separate Link column per standing rule.

## Commit
`a1ddcef` — "docs: 2026-07-16 - Thasitha R2 remove Link column, make product title clickable"
Pushed to `github.com/kuberandigit-coder/aios-2` (main).

## Deploy
`vercel --prod --yes` from `reports/digital-marketing-member-pages/` — deployment `dpl_6P9UqXUqdx2wWoAipaoo12xFEZ6y`, `readyState: READY`, target: production.
URL: https://digital-marketing-member-pages-u24l8vto3.vercel.app
