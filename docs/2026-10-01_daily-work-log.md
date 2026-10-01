# Daily Work Log — 2026-10-01

- **dm-dashboard — Content Gap Analysis bug fixes.** Fixed a real crash:
  `loadQuota is not defined` was being called from `ContentGapAnalysis.jsx`
  but never defined anywhere in the file (leftover copy-paste from
  `AltTextKeywordFinder.jsx`'s own real quota system) — the error was
  silently swallowed by the surrounding try/catch, so every successful
  competitor analyze was incorrectly shown as a failure. Removed the
  orphaned call. Pushed to `dev-work` (`330a15d`).
  Then diagnosed a separate real issue: the same page's "Analyze" button
  was returning `429` for every URL, including ledsone.co.uk's own pages.
  Confirmed live (side-by-side curl vs Python `requests` vs `curl_cffi`,
  same URL, same server, same moment) that Cloudflare — Shopify's own
  front-end infrastructure on every store — fingerprints and blocks the
  `requests` library's TLS/HTTP handshake specifically, independent of IP,
  User-Agent text or request rate; `curl` and `curl_cffi` both passed
  cleanly. Swapped `http_fetch.py`'s `_raw_get` to
  `curl_cffi.requests.get(impersonate="chrome")`, fixing this for every
  tool sharing that fetcher (Content Gap Analysis, Internal Linking).
  Added `curl_cffi==0.16.3` to requirements.txt. Pushed to `dev-work`
  (`e1af083`), merged to `main`, deployed (two real deploy snags hit and
  fixed along the way: a timing race where `git pull` ran before the
  GitHub merge had finished pushing, and an uncommitted local change on
  the server blocking the pull — stashed, not discarded, pending whoever
  made it confirming it's still needed).

- **dm-dashboard — Search Intent → Page Action (Dilaksi, developer:
  Kuberan), new Development Task.** Built per the AIOS task spec: finds
  GSC queries where intent doesn't match the ranking page's type, and
  turns it into a tracked task list. Real data source confirmed and used
  (business DB `google_search_console.query_page`, 8 real sites,
  554 days of history) — the app DB's own unused `gsc_live` schema was
  correctly identified as never-populated and avoided. Deterministic
  classification (no AI), the task's own priority rules implemented
  exactly, before/after comparison from real adjacent weeks, task
  tracking (owner/due date/status) in one new table. Logic unit-tested
  against the spec's own worked examples (all 5 matched exactly); the
  router's SQL verified live against real data. Full live-server
  smoke test not possible from this dev machine (business DB connection
  hung, consistent with its documented connection cap/network
  restriction) — flagged as the one remaining open item before calling
  this fully done. See
  [[2026-10-01_search-intent-page-action_closure]].

- **DC Voltage — "E27 vs B22 vs GU10" blog post, R19 fixes (listing
  corrections, requested by Mani, deadline 17:00 Sri Lanka time).**
  Validator (Muguntha's side) had flagged 2 open items after the earlier
  E27/ST64 model task was approved: the ST64 ~1025 product's SEO title
  still showed old wording, and the guide blog post had a duplicate H1,
  no link to the new `/collections/e27-bulbs`, and no FAQPage schema
  despite having a real FAQ section.
  Fixed all 4:
  1. ST64 ~1025 product — Search engine listing → Page title updated to
     "Dimmable ST64 E27 LED Filament Bulb, Amber ~1025 | DCVOLTAGE".
     Saved, confirmed live.
  2. Blog post body — hero `<h1>` changed to `<h2>` (page already gets
     its real H1 from the theme's own blog-post title field, so the
     content block's own `<h1>` was the duplicate Mani flagged).
  3. "Shop E27 Bulbs" CTA button href changed from the single product
     page to `https://dcvoltage.co.uk/collections/e27-bulbs`.
  4. Added a `<script type="application/ld+json">` FAQPage schema built
     from the 6 existing visible FAQ Q&As already in the post — nothing
     fabricated.
  5. Blog post meta description added (separate SEO field): "E27, B22
     and GU10 explained: how to tell your bulb fitting apart, with
     photos, so you order the right replacement first time."
  Real bug hit and fixed along the way: the first pasted version used a
  `<style>` block for all layout CSS, but Shopify's blog content editor
  strips `<style>` tags on save (confirmed live — page rendered as
  plain unstyled text, oversized hero image, unstyled FAQ buttons).
  Rebuilt the entire stylesheet as inline `style=""` attributes (CSS
  custom properties defined once on the outer wrapper, referenced via
  `var()` on every child element) so the layout survives Shopify's
  sanitizer. Confirmed live afterward — fonts, cards, table, FAQ layout,
  and CTA box all render correctly. Tradeoff flagged to Kuberan: hover
  effects and mobile responsive stacking don't survive an inline-only
  conversion (would need the CSS moved into the theme's own stylesheet
  instead, not done — only flagged as a future option).
  Known pre-existing issue, left as-is per Kuberan's call: the "Shop
  GU10 Bulbs" CTA button links to `/collections/gu10-bulbs`, which 404s
  — that link was already in the original content before these fixes
  and is out of scope for R19; the real GU10 collection handle needs
  checking separately.
  All R19 items confirmed done and live; Kuberan to reply "R19 done" to
  Mani.
