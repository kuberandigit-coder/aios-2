# Validation — sales25.js/sales25.html: 2025 Full-Year Backfill (Jul–Dec)

| Check | Result |
|---|---|
| `node -c api/sales25.js` (syntax) | PASS |
| `SUPPORTED_MONTHS` includes all 12 months | PASS — confirmed via live `supportedMonths` field in API response |
| Live `?group=sonya&month=2025-07` after code deploy, before snapshot generation | PASS — `success:true`, slow live path (Shopify query, no snapshot yet) |
| All 42 snapshot files present (`ls api/data | grep sales25-.*-2025-(07\|08\|09\|10\|11\|12) | wc -l`) | PASS — 42/42 |
| Second deploy (post-snapshot-generation) required to serve fast path | PASS — confirmed Nov snapshot request was still hitting live Shopify (timed out at 60s) until this second deploy landed |
| `?group=sonya&month=2025-08` post-redeploy | PASS — `cacheStatus:"static-snapshot"`, `orderTotalSum: 7299.96` |
| `?group=sonya&month=2025-10` post-redeploy | PASS — `cacheStatus:"static-snapshot"`, `orderTotalSum: 7364.81` |
| `?group=sonya&month=2025-11` post-redeploy | PASS — `cacheStatus:"static-snapshot"`, `orderTotalSum: 7450.13` |
| `?group=sonya&month=2025-12` post-redeploy | PASS — `cacheStatus:"static-snapshot"`, `orderTotalSum: 5239.34` |
| `git status` before commit — only expected files staged | PASS — `sales25.js`, `sales25.html`, 42 new `api/data/sales25-*.json`, no unrelated/secret files |
| Committed and pushed | PASS — commit `213fb01`, pushed to `origin/main` |

**Status:** PASS
