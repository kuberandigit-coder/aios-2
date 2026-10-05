# Daily Work Log — 2026-10-05

- **dm-dashboard — styled the Users page's editable role dropdown.** The `<select>` shown
  while editing a user's row was unstyled browser default, out of place next to the colored
  "admin"/"staff" pill badge shown everywhere else in that table. Added `.admin-role-select`
  (same shape, color, weight as the existing badge, plus a custom dropdown arrow). Pushed to
  `dev-work`.

- **dm-dashboard — diagnosed and fixed a real, consistent 500 error on Sync Monitor's
  "Sales — Auto-Sync Status" page ("Failed to load sync status"), plus 3 more instances of
  the same bug class found by sweeping the rest of the backend.** Reported by Kuberan with a
  screenshot; a hard page refresh didn't fix it, which ruled out a stale-cache/token
  explanation. Confirmed first that the backend itself was healthy (real sync rows writing to
  Postgres every few minutes, no errors) — this was not a repeat of the 2026-10-02 outage.
  Asked for the browser's Network tab, which showed `/api/sales/sync/status?scope=X`
  returning HTTP 500 for every single scope value tried (sales, and every dev-task scope),
  while the sibling `/api/sales/sync/history` endpoint succeeded every time. That 100%,
  scope-independent failure rate pointed at code shared by every call path rather than
  scope-specific logic.
  Root cause: `sales.py`'s `sync_status()` did `from .scheduled_snapshot import REGISTRY` —
  a relative import left over from before the backend restructuring, when `scheduled_snapshot.py`
  lived flat in `app/`. It now lives in `app/core/`, so this import resolved to a module that
  doesn't exist and raised `ModuleNotFoundError` on every call. `py_compile` and
  `import app.main` never caught it because it's a local (function-scoped) import — it only
  fails when the function actually runs, not at module load time.
  Swept the whole backend for the same leftover-path pattern and found 3 more live, broken
  instances: `ai_chat/ai_shared.py` (`from .db import get_conn` / `get_business_conn`, used
  by every AI chat assistant to save/load conversation history), `ai_chat/kamsi_ai.py` and
  `ai_chat/sajeepan_ai.py` (`from .auth import verify_admin_token`), and
  `staff_pages/jefri_ai_assistant.py` (`from .scheduled_snapshot import REGISTRY`). All 4
  files fixed (`from ..core.X import ...`, matching the already-correct module-level imports
  in the same files), verified by actually calling the fixed function against real data (not
  just checking it compiles), and confirmed via a final repo-wide grep that no instances of
  this pattern remain anywhere. Pushed to `dev-work`. See
  [[2026-10-05_production-incidents-broken-imports_closure]].

- **Internal request — full LEDSone UK SKU + price export.** Pulled every product and variant
  directly from Shopify's live Admin GraphQL API (not a cached source), with nested
  pagination so no variant could be lost even on a product with many variants. Result:
  5,304 products, 18,166 SKU rows, written to
  `sku-price-exports/ledsone_uk_skus_prices_2026-10-05.csv`. Kuberan pushed back twice on
  whether the total was really complete — both times followed up with real independent
  checks rather than just reasserting the number: Shopify's own live `productsCount` field
  (separate from the export's own pagination code) matched exactly; a cross-check against the
  business DB's nightly listings sync showed a 4-product gap explained by normal sync lag;
  and a full status breakdown uncovered that Shopify has a 4th product status beyond the
  commonly-known 3 (Active/Draft/Archived) — **Unlisted** (93 products, published to no sales
  channel but not deleted) — confirmed those were already included in the export, not missed.
  67 variants have a blank SKU field in Shopify's own data; flagged explicitly rather than
  hidden or fabricated. See [[2026-10-05_ledsone-uk-sku-price-export_closure]].

- **GA-19 — DC Voltage Organic Discovery pack, first task from the new shared Organic
  Discovery doc.** Site-wide product title H1 fix (two separate bugs found: the theme's
  "H1" setting only applied CSS styling, not the real tag, which was hardcoded as `<h3>`
  separately; plus a second duplicate heading in the sticky add-to-cart bar) — both fixed
  and verified live. Enabled Judge.me's star rating badge + review widget using real review
  data (27 published reviews), confirmed live. Set up Shopify Admin API access for dcvoltage
  from scratch (none existed before) to pull live numbers for Parts 3 & 4 instead of the
  week-old audit — found the real current counts are higher than the stale numbers (57
  compare-at price issues vs. the audit's 41; 1,356/4,196 images missing alt text vs.
  1,385/3,655) — sent a full report to Muguntha, cc Hethesha and Sajeepan (DC Voltage's ads
  lead), since neither is theme work and both need her approval first. Created the B22 Bulbs
  (7 products) and E14 Bulbs (1 product) collections live, with SEO title/meta matching the
  existing E27 Bulbs pattern — verified real product counts first via a full sweep (titles,
  descriptions, tags, variant titles, SKUs), not just title matches, catching one B22 product
  only findable via its SKU. Confirmed with Kuberan that B22/E14 should also get the same
  richer content E27 Bulbs already has (intro box, quick links, shape table, FAQ, breadcrumb,
  schema) — logged as the explicit next step. Wall Light's answer-first intro still in
  progress. See [[2026-10-05_ga19-organic-discovery_closure]].

- **GA-19 Part 6 completed, then Muguntha's live review caught 4 real gaps — all fixed
  same day.** Finished Wall Light's answer-first intro (prepended above the existing
  article, FAQ section rebuilt into a proper accordion with a rotating icon) and pushed
  live. Muguntha then reviewed the whole task live and flagged: B22's SEO title and E14's
  SEO title both looked filled in in the admin editor but had never actually saved (an
  unsaved-placeholder issue, not a typo); Wall Light had two real `<h1>` tags (the
  collection's own auto title plus the article's own heading); and the intro rendered below
  the product grid instead of above it. Fixed all 4, each confirmed via direct raw-HTML
  fetch of the live page, not just the admin preview. The intro-position fix needed two
  attempts — the first (reordering a shared template block) accidentally moved every
  collection's description above its grid site-wide, caught and reverted the same session;
  the correct fix was a dedicated template for Wall Light only, reusing the same reusable
  section already proven live on E27 Bulbs rather than hardcoding raw content. Build
  confirmed: one real H1, answer-first box between the title and the grid, FAQ accordion
  styled. Reply with proof, and a status update covering GA-19 as a whole (4 of 6 parts done
  on Kuberan's side; Parts 3 & 4 since reassigned by Muguntha to Sajeepan/Hethesha, with
  deadlines today and 09/10), ready to post in the team thread. See
  [[2026-10-05_ga19-organic-discovery_closure]].
