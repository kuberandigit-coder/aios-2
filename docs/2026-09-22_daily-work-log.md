## 2026-09-22 Daily Work Log

### Task: Kamsi Task 08d — Top 10 Blog Title Finder
- Built the full dev-task pipeline (real Shopify page content -> keyword extraction -> new isolated SerpAPI.com integration -> Top 10 Google UK organic classification -> title generation -> QA -> human review). Live-tested end to end with a real SerpAPI key.
- Later: full UI overhaul (tabs, API Limits, Verify, layout fixes across 3 rounds of user feedback) and a full prompt/workflow redesign per a new explicit business requirement — the AI now generates 10 differentiated title candidates per run (not 1), each with a format type + differentiation reasoning; a human picks one before it enters the existing QA/review lifecycle. Schema migration applied to the already-deployed table.
- Status: implemented, live-tested, pushed to `dev-work` only. Not yet deployed/closed — pending a deployment decision.
- Docs: `evidence/handover/validation/Kamsi/2026-09-22_kamsi-task08d-blog-title-finder_*.md`.

### Task: Alt Text Optimization — lightbox, count-guessing fix, Copy/Done/Verify
- Fixed a real accuracy bug (AI stated a wrong item count in alt text because the generator is text-only and got biased by product-title wording) with an explicit prompt rule.
- Added click-to-expand image lightbox, and a Copy/Done/Verify manual-update workflow for the disabled Shopify auto-write path (Verify Now re-checks the image's real live alt text on Shopify and reports Verified/Mismatch).
- Status: implemented, live-tested, pushed to `dev-work`. Not confirmed deployed.
- Docs: `evidence/handover/validation/dm-dashboard/2026-09-22_alt-text-regenerate-and-review-tools_*.md`.

### Task: Meta Title & Description Audit — Regenerate diversity + keyword edit
- Root-caused why Regenerate could return byte-identical output (no `temperature` set on the LLM call, no prompt awareness it was a regenerate) and fixed it with a reusable pattern (see new capability record). Also made the Generated Titles/Descriptions log tab's keyword field editable (it previously silently reused the original keyword forever).
- **Confirmed live in production** the same day via direct API calls.
- Status: COMPLETE.
- Docs: `evidence/handover/validation/closure/dm-dashboard/2026-09-22_meta-audit-regenerate-diversity-fix_*.md`, `capability/2026-09-22_anti-repeat-regenerate-pattern_capability.md`.

### Task: Sales 2026 UK — Shopify Actuals tab bug chain
- Found and fixed 5 compounding bugs behind a stuck "No data" tab: no frontend polling, a stale pre-rewrite cache, a hard-timeout fix that itself deadlocked, a missing `read_reports` Shopify scope, and a wrong ShopifyQL column name (`sales_reversals` -> `returns`).
- **Confirmed live in production** — 9 months of real 2026 GBP sales data returning correctly.
- Status: COMPLETE.
- Docs: `evidence/handover/validation/closure/dm-dashboard/2026-09-22_sales2026-uk-shopify-actuals-fix_*.md`, `source-map/2026-09-22_sales2026-uk-shopifyql-read-reports-access_source_map.md`.

### Task: Mahima Requirement 4 (Product ID Coverage) — full rebuild
- Found the page was showing ~10x the real product count via a chain of scoping bugs (wrong currency-based store filter, then a second unrelated data source mixed into the correctly-scoped feed_label). Settled definitively via exact ID-level verification against `listings.shopify_listings` and Shopify's own Admin API. Rebuilt the product universe on the real, verified Shopify catalog; also fixed the feed-eligibility heuristic (was flagging 100% of products) with a critical-vs-recommended attribute split matching Google's real requirements.
- **Confirmed live in production**. Surfaced a genuinely new, previously-invisible finding: 84% of the real Shopify DE catalog has no Google Merchant Center feed row at all.
- Status: COMPLETE.
- Docs: `evidence/handover/validation/closure/mahima/2026-09-22_req4-product-id-coverage-rebuild_*.md`, `source-map/2026-09-22_mahima-req4-listings-shopify-listings_source_map.md`.

### Standing-rule change (mid-session)
- User gave an explicit new instruction: stop pushing dm-dashboard commits directly to `main` — `dev-work` only going forward, `main` gets updated via the project's own existing dev-work merge process. Saved to Claude's own memory system for future sessions. The Sales2026 UK fix chain (above) is the task that was in progress when this instruction was given, hence it has commits on both branches.
