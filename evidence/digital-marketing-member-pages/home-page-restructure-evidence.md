# Evidence — Digital Marketing Member Pages Hub Creation

**Title:** Homepage + member-page structure creation and Dilaksi page relocation
**Purpose:** Document discovery, copy decision, and structure for the DM team navigation hub.
**Task date:** 2026-07-02
**Owner/reviewer:** Kuberan (GPT planning layer)

## Source paths checked (pre-build discovery)
- `reports/**/*.html` → exactly **one** Dilaksi HTML found: `reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html` (single source of truth — no ambiguity stop condition).
- `**/digital-marketing*` → no existing digital-marketing homepage (no duplicate-truth risk).
- `**/index.html` → only EOD tool and Blog tool homepages (different projects, untouched).
- Vercel: Dilaksi page was never deployed (vercel notes: ON HOLD) → moving/copying cannot break a deployment.

## Old → New Dilaksi path
- **Old (kept, unchanged):** `reports/dilaksi/dilaksi-ga4-seo-organic-last-30-days.html`
- **New (copy):** `reports/digital-marketing-member-pages/pages/dilaksi.html`
- Decision: **copy, not move** — the old path is referenced by evidence/validation/handover files and the Staff-requirements- GitHub repo push; moving would break the documented evidence trail. Content byte-identical, no edits needed (page uses inline CSS only, no relative dependencies).

## Files created
- `reports/digital-marketing-member-pages/index.html` (hub, 15 cards, name filter)
- `pages/dilaksi.html` (copy) + 14 placeholders: hetheesha, jakshan, jefri, kamsi, mahima, ripson, sajeepan, sonya, sukirtha, thanishtika, thasitha, theekshy, thishoban, thivagini (each states: member name, Status "Pending requirement — page not built yet", Source required "Google Sheet / MD", Next step "PostgreSQL-backed report page")
- `assets/css/style.css` (shared), `assets/js/main.js` (optional name filter; pages work without JS)
- 4 AIOS files (prompt/evidence/validation/handover under `*/digital-marketing-member-pages/`)

## Member spellings
Taken from the canonical list `docs/2026-07-02_eod-staff-member-names.md` (15 of the 17 — Kuberan and Piranav not in the requested team list).

**Validation result:** PASS — automated link check: all 15 hrefs in index.html resolve; shared assets exist (see validation file).
**Duplicate-risk result:** GREEN — one Dilaksi source, copy documented both directions.
**Known limits:** placeholders carry no data; Dilaksi page is a static GA4 snapshot (window ending 2026-06-27); hub not deployed.
**Status:** DONE
**Next step:** Replace placeholders as member requirements arrive; Vercel deploy only on explicit approval.
**PASS/FAIL:** PASS
