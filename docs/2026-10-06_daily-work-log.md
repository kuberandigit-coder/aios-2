# Daily Work Log — 2026-10-06

- **dm-dashboard — Blog Optimization: replaced the standalone "Generate Optimized Content"
  full-page AI rewrite with a compounding, review-then-apply fix system.** Kuberan's
  instruction: every QA/competitor issue should get its own small "Fix" button instead of one
  AI call rewriting the whole page; nothing saves until the user reviews the result and clicks
  a separate "Apply" button, and "Current Blog HTML" shows the live, compounding working draft.
  Removed the standalone "Generate FAQ Schema" and "Generate Optimized Content" sections
  entirely; FAQ schema now generates straight into the same working draft as every other fix.
  Fixed a real bug alongside this: AI regeneration calls were producing byte-for-byte identical
  output on every retry because `temperature` was never passed to the shared LLM caller — added
  `temperature=0.9` to the meta-shorten and FAQ-generation calls, relabelled buttons
  "Regenerate" once a result already exists. Pushed as `ec8ebb5`.

- **dm-dashboard — Blog Optimization: removed the Competitor Analysis section entirely**, per
  explicit instruction. Deleted `content.py` (whose only purpose was the competitor-gap fix),
  removed the `/blogs/competitor-check` and `/blogs/fix-competitor-gap` endpoints and the
  `competitor` field from `/blogs/detail`'s response. Kept the shared `content_gap_core` wiring
  inside Likely Cause only, since that feature still legitimately uses the same underlying data.

- **dm-dashboard — Blog Optimization: moved off the external business database for Google
  Search Console data, onto this app's own Postgres, synced weekly by a live GSC API call.**
  Kuberan's original question ("remove all the accounts, check which GSC API is actually
  available") led to live-testing every site in the old 8-site list directly against the real
  GSC API (not just checking `.env` for credential existence) before building anything.
  Confirmed only 3 of 8 sites are actually reachable with this app's own GSC credentials:
  `ledsone.co.uk` and `ledsone.de` via the shared service account, `ledsone.fr` via its own
  dedicated service account; the other 5 (`ledsone.us`, `dcvoltage.co.uk`, `vintagelite.co.uk`,
  `electricalsone.co.uk`, `besbet.co.uk`) all return HTTP 403 — the external business DB's
  broader access comes from something entirely outside this app, not these two credentials.
  Built `gsc_sync.py` (paginated live searchAnalytics calls, bulk `unnest()` upsert — found and
  fixed a real bug here: GSC's API mixes JSON ints and floats for `ctr`/`position` in the same
  response, which psycopg's array dump rejects as mixed-type; every site was silently writing 0
  rows until this was coerced to `float()` explicitly), two new tables
  (`blog_optimization_gsc_page`/`_query`), and a weekly `ScheduledSnapshot` registered the same
  way every other scheduled dev task is. `gsc.py`'s reads now go through the app's own DB
  instead of `get_business_conn()`; `SITES` is now derived directly from the sync module's own
  site list (single source of truth). Discovered along the way that Sync Monitor's sidebar is
  actually driven by a separate hardcoded array in `DevLayout.jsx`, not the page's own internal
  scope-filter maps — missed on the first pass, found when the new entry didn't appear after
  deploy, fixed in a follow-up commit. Series of commits: `25fc4d1`, `748add9`, `abe12f7`,
  `87c86bc`.

- **dm-dashboard — Blog Optimization: connected Shopify content lookup for ledsone.de and
  ledsone.fr** (previously hardcoded to ledsone.co.uk only, left over from before the GSC
  migration added the other two sites as supported). Rewrote `shopify.py` with its own
  store-aware resolver instead of reusing `kamsi_blog_title_finder`'s `_resolve_blog`, which is
  intentionally UK-only for that unrelated task. Live-tested against real articles on both
  sites: **ledsone.fr works end-to-end**; **ledsone.de's Shopify app token is missing the
  `read_content` access scope** (GraphQL `articles` query returns `ACCESS_DENIED`) — not a code
  fix, needs that scope granted to the DE app in Shopify admin. Until then DE's GSC metrics work
  but content-dependent features (Current Blog HTML, QA Check, Fix/Apply) correctly return
  "DATA NOT AVAILABLE" rather than guessing.

- **dm-dashboard — Blog Optimization: two small UI fixes on the detail page**, both from direct
  user feedback on the live page: (1) the quick-nav strip (Performance/Queries/Cause/QA
  Check/Current HTML/Checklist) was stuck together with the breadcrumb header as one sticky
  unit, so scrolling down hid both — split them so only the nav strip stays pinned while the
  header scrolls away normally; (2) "Current Blog HTML" opened on the Code tab by default,
  changed to open on Preview.

- **dm-dashboard — Blog Optimization: applied fixes now persist, plus a "Locate Changes"
  button, manual-change tracking, and a proper Completed-tab detail view.** Applied fixes
  previously lived only in React state and silently reset to "not applied" on every reload —
  new `blog_optimization_fix_log` table persists each applied fix (and each manually-confirmed
  QA item) per blog, with a `GET /blogs/fix-log` hydrating the page on load. New "Locate
  Changes" button on any applied fix: finds the differing span between that fix's before/after
  HTML (common-prefix/common-suffix is sufficient since every fix only inserts or replaces one
  region), scrolls Current Blog HTML into view, switches to Code, and selects + briefly
  highlights the exact changed span. QA items with no automated fix (edited directly in Shopify
  by hand) get a "Changed" button to confirm and persist that they were handled manually. The
  Completed tab now has an explicit "View Changes" button per row, reusing the same detail view
  with full fix history. Verified the new table and its read/write functions with a live
  round-trip test against the real database before pushing. Pushed as `617e690`.

All of today's work pushed to `dev-work`; merged to `main` via the usual Dev Tools process
across the day as each piece was confirmed working. See
[[2026-10-06_blog-optimization-gsc-live-api-migration_closure]].
