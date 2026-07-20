# Handover Notes — Jefri Req1: Product Status Labels

**Title:** Deployment blockers and next steps
**Purpose:** Hand off the two stop conditions blocking this requirement from going live.
**Requirement source:** `What_I_Need_To_Improve_ADS_Performance - Jefri.csv`
**Team member:** Jefri · **Department:** Google Ads
**Business question:** Which advertised products are Heroes, Villains, Zombies or Sidekicks?
**Files created:** `pages/jefri.html`, `api/jefri/product-status.js`, `package.json`
**Evidence paths:** `evidence/jefri/`, `validation/jefri/`
**Owner/Reviewer:** Kuberan (coordinator/technical), Jefri (business validator)
**Status:** BUILT, NOT DEPLOYED — stop conditions below require Kuberan/Jefri action before this can go live.

## Stop condition 1 — Missing DATABASE_URL

The API (`reports/digital-marketing-member-pages/api/jefri/product-status.js`) reads
`process.env.DATABASE_URL` (or `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`) —
none of these exist yet in the `digital-marketing-member-pages` Vercel project.

Claude Code cannot enter the password itself under any circumstance — this is a hard rule,
not a preference. **Kuberan needs to run this himself**, in his own terminal (not pasted into chat):

```
cd "C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages"
vercel env add DATABASE_URL production
```

When prompted, paste:
```
postgresql://dbhub_readonly:<PASSWORD>@207.148.78.148:5432/postgres
```
(with the real password — never share it in chat/files/screenshots).

**Important discrepancy to resolve first:** the requirement specifies database `postgres`
at host `207.148.78.148`. All discovery for this build was done through the project's
existing `ledsone-db-mcp` connection, which resolves to a database named `ledsone`
(same read-only user `dbhub_readonly`). Every table used (`google_ads.product_performance`,
`google_ads.ad_group_products`, `listings.shopify_listings`, etc.) was found there, and
matches tables used by other AIOS dashboards (Thasitha R2/R3) — strongly suggesting `ledsone`
is the correct/actual database and the requirement's "postgres" is either the default admin
db name or a typo. **Before adding `DATABASE_URL`, confirm with whoever manages this database
directly** (not through the MCP abstraction) whether `207.148.78.148:5432/postgres` is really
the same server/data as the `ledsone-db-mcp` connection, or a different one. If it's a
genuinely different host, the SQL in `api/jefri/product-status.js` needs to be re-validated
against that server's actual schema before going live — do not assume it's identical.

## Stop condition 2 — Vercel Hobby-plan function cap

`digital-marketing-member-pages` is already at Vercel's Hobby-plan limit of 12 serverless
functions. Adding `api/jefri/product-status.js` makes 13 — the deploy will fail with
`"No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan."`
(this exact error was hit and resolved twice already this week for other staff members'
dashboards, by merging near-duplicate endpoints).

Per the requirement's own "SYSTEMS NOT TO TOUCH" rule ("do not modify unrelated staff
pages"), Claude Code did **not** unilaterally merge or touch any other function to free a
slot this time. **Kuberan needs to decide:**
- Option A: upgrade the Vercel project to a Pro plan (removes the cap entirely), or
- Option B: identify which existing function(s) are safe to merge/retire to free a slot
  (needs sign-off from whoever owns those other dashboards)

## Once both are resolved

1. Redeploy: `cd reports/digital-marketing-member-pages && vercel --prod`
2. Test the endpoint directly: `curl https://digital-marketing-member-pages.vercel.app/api/jefri/product-status`
3. Open `https://digital-marketing-member-pages.vercel.app/pages/jefri.html` and confirm:
   - KPI cards populate (Total/Heroes/Villains/Zombies/Sidekicks)
   - Table loads with real rows, sortable columns work, search/tag/status filters work
   - Refresh button re-fetches
4. Update `validation/jefri/2026-07-20_validation-results.md` status from AMBER to PASS/FAIL based on what's actually observed live.
5. Get Jefri's sign-off as business validator, and route to an independent AIOS reviewer (not involved in this build) for the queryability review the requirement calls for.

## Known limitations (carried into production regardless of the above)

- Performance Max campaign products (~12.5% of items) show Status = "Unknown" — Merchant
  Center eligibility data does not exist in this database for PMax, confirmed during a prior
  session's investigation (`memory: project_thasitha_gmc_status_gap`). This is a real data
  gap, not something this dashboard can fix without a new backend sync job.
- Current Stock uses `listings.shopify_listings.quantity` (documented choice — see
  `evidence/jefri/2026-07-20_postgres-discovery.md`), not the deeper warehouse-level
  `inventory.physical_product_stock` table, which would require an extra identifier hop.

## Next step
Kuberan: resolve both stop conditions above, then hand back to Claude Code to redeploy and complete final validation.
