# Validation — Role-Based Login Rollout + home.html/index.html Removal (2026-08-10 → 2026-08-11)

**Purpose:** Validation record for `evidence/digital-marketing-member-pages/2026-08-10_role-based-login-and-home-removal.md`.

## Checks performed
- Confirmed all 6 original staff accounts log in individually with role-based landing pages.
- Confirmed `home.html`/`index.html` no longer exist in the deployed project.
- Confirmed site root (`/`) serves `login.html` via the `vercel.json` rewrite.
- Confirmed `cost.html` has no dead Overview link.
- Confirmed `login.html`'s redirect fallback throws a clear error instead of navigating to a 404.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
