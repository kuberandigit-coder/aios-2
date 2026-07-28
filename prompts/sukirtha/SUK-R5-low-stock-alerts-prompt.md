# SUK-R5 — Low-Stock Alerts

**Requirement ID:** SUK-R5
**Title:** Low-Stock Alerts
**Store:** ledsone.de
**Purpose:** Give Sukirtha a live view of which product variants on ledsone.de currently have low stock and need reordering/attention.
**Business Question:** Which products/variants on ledsone.de currently have low stock and require attention?

## Original Requirement Prompt

Add a Requirement 5 tab to the existing `sukirtha.html` member page (do not create a new page, do not touch Requirements 1-4) showing a table of:

- SKU
- Product ID
- Current Stock
- Status (Low Stock / OK)

Data must come only from the ledsone.de Shopify Admin API (read-only), using Variant ID as the internal unique key (not SKU, since SKUs can be missing/duplicated). Current Stock = summed `available` inventory quantity across operational locations. Status = Low Stock when Current Stock is below an **approved** threshold — never invented.

Must include: summary cards, filters (SKU, Product ID, Status, Product Status, Inventory Location), Refresh Data button that makes a fresh server-side Shopify call, CSV export of the filtered view, sort by Current Stock ascending by default, and no Shopify credentials anywhere client-side.

## Discovery Findings (2026-07-27)

- No prior low-stock threshold existed anywhere in Sukirtha/AIOS assets or Shopify config/metafields — confirmed BLOCKED and escalated to user.
- **User-confirmed threshold:** Current Stock < 10 → Low Stock, else OK.
- Live page path corrected: `reports/digital-marketing-member-pages/pages/sukirtha.html` (the prompt's stated `Staff-requirements/pages/sukirtha.html` does not exist in this repo) — confirmed with user before editing.
- Reused existing `evidence/sukirtha/SUK-R3-inventory-location-map.md` finding: ledsone.de has exactly one active/operational location, "LEDSone DE LTD".
- Reused existing secure server-side Shopify Admin API architecture in `reports/digital-marketing-member-pages/api/requirement.js` (SHOPIFY_ADMIN_TOKEN env var, never client-side).

## Owner

Owner: Sukirtha · Coordinator: Kuberan · Technical Reviewer: Sajeesan · Queryability Reviewer: Tamil Selvan · Business Validator: SEO Lead
