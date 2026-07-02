# Prompt — Digital Marketing Member Pages Homepage (Reusable)

**Title:** Create/extend the Digital Marketing member-pages hub
**Purpose:** Reusable prompt to add a new member page or refresh the hub.
**Task date:** 2026-07-02
**Owner/reviewer:** Kuberan (GPT planning layer)

## Reusable prompt

> In `reports/digital-marketing-member-pages/`:
> 1. When a member's PostgreSQL-backed report is built, save it as `pages/<member>.html` (lowercase), replacing the placeholder. Do not delete the original report from its evidence location — copy, and document old + new paths.
> 2. Update that member's card in `index.html`: change badge to `<span class="badge done">Completed / Available</span>` and set a one-line description of the report.
> 3. Keep all paths relative (`pages/…`, `assets/…`) so the folder works locally and on any static host.
> 4. Canonical member spellings: see `docs/2026-07-02_eod-staff-member-names.md` (Jefri, Kamsi, Thivagini, Hetheesha — not the old misspellings).
> 5. Validate: every `href` in index.html resolves to an existing file before committing.

**Source paths checked:** reports/ (single Dilaksi HTML), no prior digital-marketing homepage
**Old Dilaksi page path:** reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html (kept)
**New Dilaksi page path:** reports/digital-marketing-member-pages/pages/dilaksi.html (copy)
**Files created:** index.html, 14 placeholders, style.css, main.js, 4 AIOS files
**Files moved/copied:** Dilaksi HTML copied (not moved)
**Validation result:** PASS — all 15 links verified (see validation file)
**Duplicate-risk result:** GREEN — copy documented; original remains as evidence source of truth for the GA4 snapshot
**Known limits:** 14 pages are placeholders; Dilaksi page is a static snapshot
**Status:** ACTIVE
**Next step:** Build member pages as requirements arrive; deploy hub when approved
**PASS/FAIL:** PASS if new pages keep links valid and badges truthful; FAIL if placeholder replaced without PostgreSQL backing.
