# Daily Work Log — 2026-10-07

- **dm-dashboard — Blog Optimization: fixed a blank Performance table on "View Changes" from the
  Completed tab.** The detail drawer's Performance table read its numbers off the row object
  passed in when opening it, which only carries full data when opened from the main Clicks-Down
  list — "View Changes" from Completed only passes the page URL, so Clicks/Impressions/Position/
  CTR all showed blank for a blog someone had already finished. Fixed by preferring the already-
  fetched `detail.performance` data instead, falling back to the row prop only if detail hasn't
  loaded yet — zero behaviour change for the main list flow. See
  [[2026-10-07_blog-optimization-performance-table-fix_evidence]].

- **dm-dashboard — created a single reference doc covering every existing Development Task**,
  at the user's request, to feed into a planning discussion (ChatGPT) for a new "Blog HTML
  Automation" feature before building it. Shared infrastructure, per-task purpose/data-sources/
  workflow/status, and a "things worth knowing" section flagging real gotchas (no Shopify write
  access anywhere, uneven GSC/Shopify access per site, the Sync Monitor two-registration quirk).
  See `docs/2026-10-07_dm-dashboard-development-tasks-overview.md`.

- **dm-dashboard — Blog HTML Automation, Steps 1-3: audit, architecture, implementation, then a
  full afternoon of follow-on feature work, all in one continuous session.** Step 1 audited
  every existing reusable system (local_llm, faq_schema, content_gap, internal_linking, Blog
  Optimization's GSC data, Shopify client) and found 2 real hardcoded `ledsone.co.uk` risks in
  `qa_check.py` and `faq_schema.py` — fixed the same day (both now derive domain/locale from the
  already-passed `page_url`, zero caller impact, live-verified for UK/DE/FR). Step 2 designed the
  full architecture reusing everything found in Step 1 with zero new duplicate systems. Step 3
  implemented it: new `blog_html_automation` package, one new table, full pipeline (input
  aggregation → clean/group → outline → generation → QA → review → manual publish → history),
  live-tested end to end against real DE Shopify products and real GSC data. Found and fixed two
  real bugs the same day: AI body copy reliably undershot the word-count target (switched from
  one big call to section-level generation) and a false-positive HTML QA check (void elements
  like `<img>` were being miscounted as unclosed tags). Then kept building per live feedback:
  Collection-URL-first form reorder with real keyword suggestions (derived from the real
  collection title + matching GSC queries, no fabrication); review-then-apply QA fix buttons,
  real meta title/description generation, and a fully clickable/re-editable History view (even
  after Published); and finally, matched the generator's actual output structure to a real
  reference blog the user pointed at (H3 subsections, bullet highlights, a real product
  comparison table, labeled "Shop the Range"/"Final Thoughts" blocks, word/FAQ targets raised to
  match the reference's real numbers). See [[2026-10-07_blog-html-automation-step1-audit_evidence]],
  [[2026-10-07_blog-html-automation-step2-architecture_evidence]],
  [[2026-10-07_blog-html-automation-step3-implementation_evidence]],
  [[2026-10-07_hardcoded-store-brand-fix-audit_evidence]], and the Step 3 handover's later
  sections for the keyword-suggestion/QA-fix/structure-match additions.

- **dm-dashboard — set up CI/CD: every merge to `main` now auto-deploys to the Contabo VPS.**
  Walked through live, step by step, with the user doing every action themselves (SSH key
  generation, authorizing it on the VPS, adding 4 GitHub secrets, creating the workflow file) —
  no credentials ever shared in chat, by explicit design. Verified twice: GitHub's own Actions UI
  showed the first real run succeed in 19 seconds, then independently confirmed on the VPS itself
  via `journalctl` that the backend genuinely restarted. Added a visible warning to the
  dashboard's own "Branches" merge page so the new deploy-on-merge behaviour isn't a silent
  surprise, plus a temporary visible marker so the user could confirm a second live deploy by
  eye. Documented in `docs/CI-CD-SETUP.md` (dev-facing, kept current) and recorded here with a
  Word doc + screenshots (trimmed to a clean success-only sequence per explicit request). See
  [[2026-10-07_cicd-github-actions-implementation_evidence]].

All of today's dm-dashboard work pushed to `dev-work` (one piece, the CI/CD workflow file itself,
committed straight to `main` per the nature of the task); merged to `main` via the usual Dev
Tools process for everything else.
