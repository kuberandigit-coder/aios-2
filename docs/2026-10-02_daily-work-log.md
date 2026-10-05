# Daily Work Log — 2026-10-02

- **DC Voltage — E27 "Next Level" quick fixes (9 items, deadline 18:00 Sri Lanka time, task
  file `Kuberan_E27_next_level_2026-10-01 (2).txt`).** All 9 items due today finished and
  confirmed: C1, C3, C4, P1, P2, P5, G1, G2, G3.
  - **P5** — meta description, product 1025 (ST64 E27 bulb). Thuwaraga approved.
  - **G2** — meta description, "E27 vs B22 vs GU10" guide.
  - **P2** — FAQ 1 link on product 1025, raw bracket/arrow text replaced with a real link to
    the B22 product. Thuwaraga approved.
  - **C3** — collection page: FAQ 2 link fixed the same way; intro text's manual line breaks
    removed (plain-text field, not HTML — the stored newlines themselves were the bug). Built
    on the duplicate theme "Tinker - E27 model DRAFT" per the task's own build-on-duplicate
    rule, pending Muguntha's publish approval.
  - **G1** — guide's 3 dead links fixed: "Shop E27 Bulbs" → `/collections/e27-bulbs`,
    "Shop GU10 Bulbs" → `/collections/led-bulb` (no GU10 collection exists, so pointed at the
    general LED Bulb collection per the task's own instruction rather than leaving it 404),
    breadcrumb "Bulbs" → same. Confirmed live via direct fetch of the real page.
  - **G3** — duplicate H1 removed: the guide's oversized hero heading was `<h2>` styled to
    look like a second title; changed to a plain `<div>` with identical visual styling, no
    heading semantics. Confirmed live: exactly one `<h1>` on the page.
  - **C4** — sold-out products ~1116 and ~1226 moved to positions 16-17 of 17 in the E27
    Bulbs collection (manual sort order).
  - **C1** — collection connected: "E27 Screw Bulbs" nested as a dropdown child under "LED
    Bulb" in the main menu (took several attempts — Shopify's menu editor nests via a
    drag-up-then-right gesture, not a dedicated button); "Shop E27 (Edison Screw) bulbs" link
    added to the LED Bulb collection's own description; guide's E27 button already correct
    from G1. All 3 parts confirmed live.
  - P5, P2, P1 approved by Thuwaraga same day. C3 awaiting Muguntha's sign-off to publish the
    draft theme. See [[2026-10-02_e27-next-level-quickfixes_closure]].

- **dm-dashboard — Blog Optimization "Clicks-Down URLs" (Dilaksi, developer: Kuberan), new
  Development Task.** Built per spec: GSC page-level click comparison (last 28 days vs
  previous 28 days, business DB `google_search_console.page`/`query_page`, real data — 231
  real blog pages found on ledsone.co.uk in live test), deterministic priority rules
  (High/Medium/Low/No action), competitor gap check (reused `content_gap`'s existing SerpAPI
  pipeline), deterministic likely-cause + optional AI-written recommendation (clearly
  labelled, never presented as fact), QA checklist, Shopify/Search Console links, before/after
  snapshot tracking. Reused existing infrastructure throughout (search_intent_page_action's
  page-type classifier, kamsi_blog_title_finder's Shopify article resolver, content_gap's
  competitor pipeline, ai_chat's call_gemini) instead of duplicating any of it. Registered in
  User Access Management (`tools.DevBlogOptimization`). Pushed to `dev-work`. See
  [[2026-10-02_blog-optimization-dev-task_closure]].

- **dm-dashboard — fixed the Alt Text Keyword Finder's Update History table text overlap**
  (2 instances: the main Update History table and the Results step's per-product image table).
  Root cause: a long Shopify filename next to a thumbnail had no width constraint inside its
  flex row, so it overflowed past the column and visually overlapped the next column's text.
  Fixed with `minWidth: 0` + ellipsis truncation on the filename link in both places.

- **dm-dashboard — fixed two dev tasks missing from the sidebar.** Blog Optimization and
  (from an earlier session) Search Intent → Page Action were both registered in
  `taskRegistry.js` (used by User Access Management's grant list) but never added to either
  `AdminLayout.jsx` or `DevLayout.jsx` — the two separate, hand-maintained sidebar files that
  actually render the Development Tasks menu. Added both to both files. Then **deduplicated
  the underlying problem**: built one shared `devTasksRegistry.js` so a new dev task only
  needs registering once going forward, instead of three separate places independently.

- **dm-dashboard — fixed new staff accounts not appearing in User Access Management.**
  The Users page's "Staff Key" field is optional; leaving it blank saved `staff_key` as NULL,
  and UAM's auto-detect (new staff account → new grant-matrix column, already built, no code
  change needed per hire) requires a non-empty staff key. Confirmed against real data: the
  most recently created account (Thurgesan) had `staff_key = NULL`. Now defaults to the
  username when left blank.

- **dm-dashboard — Conduit Sold: added to User Access Management, then found and fixed a
  real access-control gap, then reworked its storage.** Added `tools.AdminConduitSold` to the
  UAM grant list. Granting it to a staff member (Thurgesan) then surfaced that the page's
  actual backend endpoint still hard-required admin/dev role regardless of the grant — fixed
  by switching to the same `make_task_auth` grant-aware dependency every other dev task uses.
  Found the same gap on the page's "Component Stock" tab (a second backend file that had
  never been carried over from `main` into `dev-work` during an earlier merge) — ported it
  in and fixed the same way. Separately reworked the main page from a 15-minute in-memory
  cache to the same `ScheduledSnapshot` pattern used elsewhere (`admin_dm_campaign.py`,
  `admin_sku_audit.py`): one Postgres table holds the last computed report, served instantly;
  an "Update" button re-runs the live Shopify fetch in the background. Also fixed a real
  accuracy gap found while auditing the page: the fetch only excluded `VOIDED` orders, never
  checked `cancelledAt`, so a cancelled-but-not-voided order could still count as "sold."
  Verified the live fetch end-to-end against real data: 17,391 UK orders scanned, written to
  Postgres, confirmed.

- **dm-dashboard — found and fixed repeated merge corruption from the GitHub "Dev Tools"
  merge UI, and one resulting production outage.** The merge tool silently replaced real code
  blocks with stray literal `main` text (`ConduitSold.jsx`) and deleted a file's opening
  docstring line (`admin_conduit_stock.py`) while resolving a genuine two-sided conflict —
  this broke the production build (`await` outside an `async function`, `Unexpected token`).
  Rebuilt both files from known-good content, verified clean, pushed. Merged the fix into
  `main` directly (explicit instruction, given production was down). A second, related bug
  from the same restructuring then surfaced separately: `main.py` was calling
  `start_conduit_sold_snapshots()` without importing it — this one wasn't caught by the
  corruption fix because `python -c "import app.main"` only proved the module *imports*
  cleanly, not that its startup hook actually *runs*; the real crash only fires when FastAPI's
  `@app.on_event("startup")` handler executes, which an import-only check never exercises.
  Diagnosed live via the user's server terminal (`journalctl -u dm-dashboard.service`): the
  service was in a 70-times-and-counting restart loop. Hotfixed directly on the server first
  (`sed` + `systemctl restart`) to restore service immediately, then committed the identical
  fix to git and merged to `main` so the deployed file matches the repo. See
  [[2026-10-05_production-incidents-broken-imports_closure]] (combined write-up with the
  second, related incident below).
