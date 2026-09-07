# Closure — Old vs New feature-parity pass (Jeffri, Kamsi, Dilaksi)

**Date:** 2026-08-25
**Project:** dm-dashboard
**Source:** Claude session record (not git log)

## What was done
- Began systematic side-by-side comparison of the old HTML dashboard vs
  the new React one, page by page, fixing gaps as found:
  - **Jeffri**: Req1 product-URL column restored (made the image
    clickable to the live product page instead, per updated direction).
    Req4 product-ID rollup restored. Req7 missing color coding restored.
  - **Kamsi**: Req1 title-under-URL added; Req2 restyled to match old;
    Req3 missing column restored; Req4 fully rewritten (was badly
    incomplete vs old, needed Semrush connector data).
  - **Kamsi Req5**: missing detail dropdown restored, color/visibility
    improved.
- Fixed a real bug: CORS only allowed port 5199, not 5173, causing
  "backend down" errors depending on which port the frontend opened on
  first load — both ports added.
- Diagnosed and fixed a "works after refresh, broken on first load" bug.
- Discussed OneDrive backup/sync implications for the project folder
  path (kept enabled, no path change).
- Prep work for approaching the dev/hosting provider: confirmed repo
  URL + branch to deploy, what needs to be shared (env file only for
  backend), clarified the business database is read-only access, no
  extra setup needed beyond the connection string already in `.env`.

## Open items at end of day
- Kamsi Req4 rewrite still needs full Semrush data verification.
- Server/hosting conversation with the dev still pending (prep done,
  not yet sent).
