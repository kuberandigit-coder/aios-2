# Evidence — Sales 2026 Added to Admin Pages' Team Tools (2026-08-12)

**Purpose:** Record of adding a missing sidebar link on the 3 admin pages.

## Background
Kuberan/Piranav/Muguntha's Team Tools sidebar sections included EOD Reports, Organic Revenue Intelligence, SEO Intelligence, and Germany Sales Decline — but no link to the multi-member `sales2.html` view, even though admins can access individual staff sales data through other routes. User asked for a direct sidebar link.

## Fix (`d9ecb77`)
Added a "Sales 2026" entry to the Team Tools `<ul>` on all 3 admin pages, pointing to unlocked `sales2.html` (no `?staff=` param, so the full sidebar with all members shows — this is intentional for admin access, unlike the staff-locked views). Kuberan/Piranav use the standard `data-tool="sales2.html"` iframe-swap pattern; Muguntha additionally uses `data-fulltool="1"`, matching its existing "full-bleed all tools" convention.

## Files touched
- `reports/digital-marketing-member-pages/pages/kuberan.html`
- `reports/digital-marketing-member-pages/pages/piranav.html`
- `reports/digital-marketing-member-pages/pages/muguntha.html`

## Deployment
Deployed to production, confirmed live via `curl` grep on `dm-dashboard.vintageinterior.co.uk/pages/kuberan.html`.

**Status:** PASS
**Reviewer:** Muguntha (pending review)
**Next step:** None.
