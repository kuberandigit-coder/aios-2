## Dilaksi Requirement 4 — Source Map

| Concern | File | Notes |
|---|---|---|
| Backend handler | `api/requirement.js` (`dilaksiReq4ContentGapModule`) | dispatched via `fn=dilaksi-req4-content-gap` |
| Frontend UI | `pages/dilaksi.html` (Tab 4 / `tab-panel-4`) | input, button, table, methodology notes |
| Semrush integration | `api.semrush.com` (live, `type=phrase_this`, `type=phrase_questions`) | key: `SEMRUSH_API_KEY` env var, server-side only |
| Existing content check | `https://ledsone.co.uk/search/suggest.json` | first-party Shopify predictive search, no scraping |
| Google PAA/AI Overview | none — explicitly unverifiable, documented | no SERPAPI_KEY configured |
