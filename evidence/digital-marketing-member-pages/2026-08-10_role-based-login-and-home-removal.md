# Evidence — Role-Based Login Rollout + home.html/index.html Removal (2026-08-10 → 2026-08-11)

**Purpose:** Record of moving from a shared/directory-style entry point to fully role-based per-account login, ending with `login.html` as the site root.

## 2026-08-10
- **Role-based login for all 6 original staff** (`98b2fe2`): Jefri/Dilaksi/Kamsi/Mahima/Thasitha/Sukirtha switched to individual role-based logins; `home.html`/`index.html` locked to admin-only access as an interim step (not yet removed).

## 2026-08-11
- **`home.html`/`index.html` fully removed** (`e4c5cb9`, `e7a11f6` — same change pushed twice): site root now serves `login.html` directly via a `vercel.json` rewrite (`{ "source": "/", "destination": "/login.html" }`). `cost.html`'s dead `../home.html` "Overview" link removed. `login.html`'s post-login redirect fallback (previously `data.redirect || 'home.html'`) hardened to throw an error instead of navigating to the now-deleted page.

## Files touched
- `reports/digital-marketing-member-pages/pages/{jefri,dilaksi,kamsi,mahima,thasitha,sukirtha}.html`
- `reports/digital-marketing-member-pages/pages/cost.html`
- `reports/digital-marketing-member-pages/login.html`
- `reports/digital-marketing-member-pages/home.html`, `index.html` (removed)
- `reports/digital-marketing-member-pages/vercel.json`

## Deployment
Deployed to production, verified live — site root serves the login page directly, no dead links to the removed pages found.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
