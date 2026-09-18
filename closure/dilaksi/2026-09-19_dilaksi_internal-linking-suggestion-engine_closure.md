# Closure — Internal Linking Suggestion Engine (Dilaksi)

Date: 2026-09-19
Owner: Dilaksi
Reviewer: Kuberan
Site: https://ledsone.co.uk
Repo: dm-dashboard, branch `dev-work` (merged to `main` throughout)

## Status: COMPLETE

All 5 steps of the Internal Linking Suggestion Engine are implemented, deployed, and confirmed working
against real production data through direct user testing over multiple sessions (2026-09-18 to
2026-09-19). This closes out the multi-day task that began with Step 01 (Content Index).

## What was built

| Step | What it does | Key files |
|---|---|---|
| 01 -- Content Index | Indexes LEDSone UK Blog/Product/Collection pages via the existing Shopify Admin API | `content_fetch.py`, `schema.py` |
| 02 -- Find Link Opportunities | Deterministic phrase matching finds candidate internal links, excludes existing links/self-links/duplicates | `link_opportunities.py` |
| 03 -- Check Existing Link Density | Measures per-page internal link counts against a documented project-config threshold | `link_density.py`, `density_rules.py` |
| 04 -- Generate & Prioritize Suggestions | Turns opportunities + density into prioritized, human-reviewable suggestions with an Approve/Reject workflow | `suggestions.py`, `priority_rules.py` |
| 05 -- Handoff, Implementation Tracking & Verification | Turns an Approved suggestion into a tracked task with live verification against the real site | `handoff.py` |
| Extra (explicitly requested) | Blog-only HTML preview/editor -- safe link insertion preview + copy-to-Shopify, with a pre-computed insertability check | `html_preview.py` |

Route/UAM/task key (unchanged since Step 01): `tools.DevInternalLinkingSuggestionEngine`, one page under
Development Tasks, one frontend file (`InternalLinkingSuggestionEngine.jsx`) with 5 tabs.

## Live verification evidence

- Step 01: real refresh confirmed 5,289 products + 490 collections + 159 blog articles indexed.
- Step 02: real scans run; a real bug (product_type phrase fan-out, 795,275-row explosion) was found live,
  fixed same-day, and the fix was confirmed via a second live scan producing sane results.
- Step 03: real density calculations run against the live index.
- Step 04: real generation (7,301 suggestions); Approve/Reject workflow used on real suggestions (3
  confirmed `Approved` via live database query).
- Step 05: handoff creation, status, and assignment UI exercised against real approved suggestions.
- Blog HTML Editor: safe-insertion logic live-verified against real blog HTML, including a case where it
  correctly REFUSED an unsafe nested-link insertion rather than corrupting the page; the `html_insertable`
  pre-check live-confirmed 55 of 732 real Blog suggestions are genuinely not insertable.

## Known, documented limitations (not defects)

- High/Medium priority in Step 04 will always show 0 -- cornerstone-page and "new blog post" classifications
  do not exist anywhere in this project, and per explicit instruction neither was invented or guessed.
- Collections/Blogs have no publish-status/availability signal captured yet (unlike Products) -- the
  out-of-stock/unpublished exclusion only covers Products.
- No content-team role or notification system exists in this project -- Step 05 assignment is a manual
  free-text field, no automated notifications on status change.
- Verification's anchor-text match is a loose case-insensitive substring check, not exact-string equality.
- The existing-link check (Step 02) verifies the source links to the target's URL somewhere on the page,
  not that this specific anchor occurrence is wrapped in that exact link.

## Security

No credentials of any kind were ever stored in this codebase's Internal Linking feature or in any AIOS
record for it. Every step is read-only against Shopify except Step 01's own indexing fetch (`Query` only,
never a mutation); Step 05's verification and the Blog HTML Editor are plain public `GET` requests to the
live site, never a write. All AIOS records for this task reference credentials only as safe descriptions
("existing Shopify Admin API integration reused"), consistent with every prior update.

## AIOS records for this task (all under the 2026-09-18/19 date range)

- `prompts/dilaksi/2026-09-18_internal-linking-suggestion-engine_prompt.md` (Step 01)
- `prompts/dilaksi/2026-09-18_internal-linking-suggestion-engine-step02_prompt.md`
- `prompts/dilaksi/2026-09-18_internal-linking-suggestion-engine-step03_prompt.md`
- `prompts/dilaksi/2026-09-18_internal-linking-suggestion-engine-step04_prompt.md`
- `evidence/dilaksi/2026-09-18_internal-linking-suggestion-engine_evidence.md` (one evolving file, UPDATE sections per step + fixes)
- `validation/dilaksi/2026-09-18_internal-linking-suggestion-engine_validation.md`
- `handover/dilaksi/2026-09-18_internal-linking-suggestion-engine_handover.md`
- `source-map/2026-09-18_internal-linking-suggestion-engine_source_map.md`
- `capability/2026-09-18_ledsone-content-index-step01_capability.md`
- This closure record

## Next steps (future work, out of scope for this closure)

- Step 05's handoff-to-completion loop (Implemented -> Verify Now -> Completed) should be walked through
  once on a real link the content team actually adds, to close the very last link in the chain.
- If a cornerstone-page classification or a "new blog post" definition is ever added to this project,
  `priority_rules.py` is the single place to wire it in -- High/Medium will start firing automatically.
- Collections/Blogs could get their own publish-status signal if genuinely needed later.
