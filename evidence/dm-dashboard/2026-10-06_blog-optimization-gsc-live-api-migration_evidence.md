# Evidence — Blog Optimization: GSC live API migration + applied-fix persistence

Date: 2026-10-06
Repo: dm-dashboard (`backend/app/dev_tasks/blog_optimization/`), pushed to `dev-work`,
merged to `main` via Dev Tools through the day.

## Trigger

User screenshot showed the Blog Optimization site dropdown listing 8 sites, asking which
actually had a working GSC API connection in `.env` — explicit instruction not to assume,
to check live. Grew into: disconnect from the external business database, call the live GSC
API directly, store in this app's own Postgres, show only confirmed-working sites, add a
weekly scheduler, register in Sync Monitor.

## Live GSC access test (before building anything)

Ran a standalone script calling `google_client.query_gsc()` for all 8 sites in the old list,
plus a direct `requests.post` test of the dedicated FR service account:

```
ledsone.co.uk   -- OK, shared GSC_SERVICE_ACCOUNT_KEY, 6122 rows in test window
ledsone.de      -- OK, shared GSC_SERVICE_ACCOUNT_KEY, 1388 rows
ledsone.fr      -- OK, dedicated GSC_LEDSONE_FR_SERVICE_ACCOUNT (200, real data: 15 clicks, 1057 impressions on a sample page)
ledsone.us, dcvoltage.co.uk, vintagelite.co.uk, electricalsone.co.uk, besbet.co.uk
                -- all HTTP 403 "User does not have sufficient permission for site"
```

## Bug 1 — every scheduled sync run wrote 0 rows, reported "success"

First live run's stored snapshot payload:

```json
{
  "sites": [],
  "errors": [
    "ledsone.co.uk: DataError: cannot dump lists of mixed types; got: float, int",
    "ledsone.de: DataError: cannot dump lists of mixed types; got: float, int",
    "ledsone.fr: DataError: cannot dump lists of mixed types; got: float, int"
  ],
  "totalPageRows": 0,
  "totalQueryRows": 0
}
```

Fix: coerce `ctr`/`position` to `float()` before building the `unnest()` arrays (GSC mixes
JSON ints and floats for these fields in the same response). Re-ran live after the fix:

```
page rows: 301175   query rows: 75606
```

Real rows confirmed, e.g.:
```
https://ledsone.de/ | https://ledsone.de/blogs/news/3-adriges-kabel-a-comprehensive-guide
https://ledsone.de/ | https://ledsone.de/blogs/news/beste-montageorte-fur-ihre-pendelleuchte-oder-hangelampe
```

## Bug 2 — Sync Monitor sidebar entry missing after a confirmed-live deploy

Verified via direct `curl` of the production asset bundles (not assumption) that the fix WAS
deployed before looking for a code bug:

```
curl .../assets/index-cYSp38_k.css | grep jreq-quicknav-sticky
  -> jreq-quicknav-sticky{z-index:2;background:var(--j-card);position:sticky;top:0}
curl .../assets/BlogOptimization-BJ7AEtA_.js | grep jreq-quicknav-sticky
  -> found (confirms correct JS chunk deployed too)
```

Root cause found separately: the sidebar menu is a second, independent hardcoded array in
`DevLayout.jsx`, not controlled by the page's own `SCHEDULED_SNAPSHOT_TABS`/`LABELS` maps.
Fixed by adding the entry to both the menu array and its rendered panel.

## ledsone.de Shopify content: real, reproducible access error

```
RuntimeError: Shopify GraphQL error: [{'message': 'Access denied for articles field.',
  'extensions': {'code': 'ACCESS_DENIED', ...}}]
```
against a real DE article URL. Same call against a real FR article succeeded:
```
FR: True None  "10 meilleures tendances d'applique murale en 2026 : Le Guide"
```

## Fix-log persistence — live round-trip test

```python
schema.save_fix_log('test-site', 'test-page', 'Heading structure', 'html',
    {'html': '<p>after</p>', 'changed': ['h3->h2']}, '<p>before</p>', True)
schema.save_fix_log('test-site', 'test-page', 'No unsupported claims', 'manual', {}, None, True)
schema.get_fix_log('test-site', 'test-page')
```
Returned both rows with the exact shape the frontend hydrates from (`kind`, spread result
fields, `beforeHtml`, `applied`, `appliedAt`). Test rows deleted after confirming.

## Commits

`25fc4d1`, `748add9`, `abe12f7`, `87c86bc`, `4a331ff`, `5c1d15f`, `400360c`, `617e690` — all
on `dev-work`, merged to `main` the same day via the usual Dev Tools process.
