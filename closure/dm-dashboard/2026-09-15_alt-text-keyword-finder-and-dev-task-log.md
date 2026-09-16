## Purpose
Document dm-dashboard commits for 2026-09-15, recovered from the `dm-dashboard` GitHub repo (`dev-work` branch) — the busiest single day found in this recovery (40 commits).

## Certainty
VERIFIED (commit existence) / SUPPORTED (business intent, inferred from commit messages).

## Summary (40 commits)
- **Alt Text Optimization / Alt Text Keyword Finder (new major feature, ~25 commits)**:
  - Core build-up: keyword-finding component added `a3935bd`; shows which specific images are missing alt text `d4c86b1`; removed Impressions/Clicks/Conversions/Cost columns from the main table `e074e97`; shows existing alt text, not just what's missing `fd4f871`.
  - Shopify write path: added bulk update of missing alt text to Shopify `b8de1fc`, on its own narrowly-scoped Shopify app `0e72fa7`; Update History audit log (who/what/when) added `72d9dec`; a 50-product-per-day-per-user limit enforced `e55cefe`; shows exact image + before/after value changed `909f575`; **"Update in Shopify" button disabled per request** `5722595`, then the write API itself disabled (not just the button) `9d6fc46`.
  - Data-quality fixes: a "2-core cable" bug getting "3 Core" wrongly selected as its keyword fixed `b928747`; collection dropdown replaced with a searchable, clickable table `5f7f788`; identical-alt-text bug fixed (positional fallback + duplicate detection) `563b4d0`; flags images where alt text just duplicates the product title `dcd47c6`.
  - AI generation path (several reversals in one day): per-image AI alt text generation added `d60af2d`; Gemini JSON-mode/token-limit fix `cf44b80`; **replaced with pure Python, no external API** `5c5aed2`, then **that revert itself reverted** `dabc9d1`; switched to the self-hosted local LLM `41f155b`; falls back to Gemini when the local LLM is unreachable `1885637`; loading state added while generating `237bbe4`; only auto-generates for genuinely missing images `c26f58f`; auto-generate + permanent cache, manual button removed `fdd5d46`; generation moved to background, one product at a time (fixes a 504) `d98d14a`; capped to 50 products per visit with auto-continue `5496425`.
  - UI structure: split into 3 tabs (Collection/Results/History) `8ab2fe6`; unified review table + one-click Generate All `88e6a05`; "Run Collections" tab added, showing every collection already generated for `f03721b`.
- **Dev Task Log (new page)**: added (manual date/user/task/benefit entries) `be7ab7b`; fixed to use `public` schema, not a new dedicated one `6a4c58d`; proper styling + CSV export `98a84cc`; User is now a dropdown from the real users table `752d15b`; split into Add Task/Tasks tabs `cb59999`; fixed oversized User dropdown, tightened Add Entry layout `1a9e415`; filter Tasks tab by user `bf3c273`.
- **Removed**: "My Dev Tasks" page (the git-history-driven tracker built 2026-09-08) removed entirely `f11ca77`; **Competitor Lens Search page removed entirely** (built 2026-09-10) `674dc04`.
- **Cross-branch sync**: `ai_shared.py` synced to main's current version to eliminate a recurring merge conflict `cbaf82f`.
- **Production hotfix**: removed a `seo_serp_tracker` import that broke production `b0b1a2e`.

## Notes
Two more features from this same week were fully removed today (My Dev Tasks, Competitor Lens Search) — continuing the build-then-remove pattern already seen with API Health Monitor and the deploy button. A production hotfix (`b0b1a2e`) indicates a broken deploy occurred and was fixed same day.

## Files / Areas
Alt Text Keyword Finder (major, ~25 commits), Dev Task Log (new page), 2 feature removals, 1 production hotfix.

## Status
VERIFIED (commit existence) / SUPPORTED (business intent). Retroactive documentation, no live-test evidence recovered.

## Evidence
`dev-work` branch commits `f03721b`..`f11ca77` dated 2026-09-15.

## Reviewer
Pending — Kuberan

## Next step
The production hotfix (`b0b1a2e`, broken `seo_serp_tracker` import) is worth a dedicated evidence file if the user wants a record of what broke and why, separate from this day-summary.
