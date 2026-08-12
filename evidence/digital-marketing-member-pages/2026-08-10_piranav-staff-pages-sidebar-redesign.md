# Evidence — Piranav's 6 Staff Pages: Merge + Sidebar Redesign + Tool Wiring (2026-08-10 → 2026-08-11)

**Purpose:** Record of merging Piranav's 6 staff dashboards (Sonya, Sajeepan, Theekshy, Thivajini, Hetheesha, Jakshan) into this project's unified login system and redesigning them to match the existing sidebar pattern.

## 2026-08-10
- **Initial merge** (`4f81f2c`): Sonya, Sajeepan, Theekshy, Thivajini, Hetheesha, Jakshan merged into the unified login system.

## 2026-08-11
- **Full sidebar redesign** (`d4f620c`, `eec16a2`, `5670c37`, `49108b0`, `6ad3417`, `13f5b03`, `d5c13e0`, `940b4b5`): all 6 pages redesigned from the old back-link + horizontal tab-nav bar to the navy collapsible sidebar (same look as `jefri.html`/`kamsi.html`); EOD Tool + Blog Tool added to each (full-bleed); Sales 2026 wired per-page where a sales group exists (Thivajini/Hetheesha → `sales2.html` tabs, Jakshan → `jackson-sales.html`); old per-page footer bars ("Developed by Piranav" strips) removed as redundant with the new sidebar dev-badge.
- **Legacy login-popup permanently removed** (`6d5c755`, 2026-08-12): the old standalone login-overlay from Piranav's pre-merge system was still physically present in the HTML on all 6 pages, causing a brief flash on load before being hidden by unrelated JS. Physically deleted (not just hidden) per explicit instruction. See `evidence/digital-marketing-member-pages/2026-08-12_legacy-login-popup-permanent-removal.md` for the dedicated record.

## Files touched
- `reports/digital-marketing-member-pages/pages/{sonya,sajeepan,theekshy,thivajini,hetheesha,jakshan}.html`

## Deployment
Deployed to production, verified live.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None called out beyond the linked login-popup fix.
