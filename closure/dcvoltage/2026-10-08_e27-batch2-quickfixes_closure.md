# Closure — DC Voltage E27 Batch 2 (S3-KUB-02)

**Date:** 2026-10-08
**Store:** dcvoltage.co.uk
**Requested by:** Website Organic Discovery bot (Telegram), due Wed 7 Oct 18:00 SL (missed),
reply deadline Thu 8 Oct 12:00 SL
**Follows on from:** [[2026-10-02_e27-next-level-quickfixes_closure]]

## Purpose

8 of 9 items from the "next level" task file were still open after the 7 Oct deadline passed:
G6, G4, P4, C5, P3, P6, C7, C2 (P10 was already live). This batch worked through all 8, one by
one, with a running reply tracker for the Telegram deadline.

## What was done

5 of 8 items fully done and independently confirmed live: **G6, G4, P4, P3, C5**. The other 3
(**P6, C7, C2**) had every part that needed no approval completed; everything else was built into
a sheet/message and sent to Thuwaraga, awaiting her reply. Full breakdown in
[[2026-10-08_e27-batch2-quickfixes]] (evidence) and
[[2026-10-08_e27-batch2-quickfixes_validation]] (validation).

## Real issues found and fixed along the way (not in original scope, but blocking)

1. **G4's live-debugging mystery.** The theme code was confirmed byte-identical correct on the
   live theme (CLI push + a theme pull diff = 0 differences), yet the public page kept rendering
   Shopify's default structured data regardless — even `dateModified` stayed frozen after
   resaving the article, while the article's own `articleBody` content demonstrably DID update
   live (ruling out caching). Root cause: `article.handle` returns the blog-prefixed value
   (`news/e27-vs-b22-...`), not just the slug — found by temporarily forcing the condition true and
   printing the real handle directly into the page. This took several push/verify cycles to
   isolate; documented in full in the evidence file so the same mistake isn't repeated on a future
   blog-scoped Liquid condition.
2. **The "duplicate theme" was never actually a duplicate.** Theme `154422902945` ("Tinker - E27
   model DRAFT") turned out to be the live, published theme — confirmed via `server-timing`
   response headers showing it serving the real public page. This means several pushes this
   session went straight to production rather than to an isolated preview, which the user flagged
   directly ("who give access to push direct remove that action") — now a standing rule: confirm
   with the user before every live theme push, no exceptions. See `feedback_confirm_before_live_push`
   in the assistant's memory.
3. **A 5-column product-recommendations grid left a visible empty gap** once only 4 complementary
   products were confirmed (template default was 5) — caught from a live screenshot, fixed to a
   clean 4-column layout with adjusted gap spacing.
4. **A Spring Sale discount code (SPRING15) had quietly expired** but was still showing on the live
   product page — found while doing the unrelated buy-box reorder (P3a), confirmed inactive with
   Muguntha, removed.
5. **A contact-page `tel:` link didn't match its own displayed phone number** (`+447522607969`
   href vs `+447923987178` shown) — found while sourcing a confirmed phone number for the
   Organization schema fix (C5b); cross-checked against Admin's own Store contact details to
   confirm which number was correct, then fixed both.
6. **37 carousel thumbnail images had zero `alt` attributes** — found and fixed as P6's
   no-approval-needed first step.
7. **The product-title sheet (C7) and filter-value sheet (C2)** both had to be built from the live
   storefront JSON endpoint rather than the Admin API, since no Admin API credential was available
   this session — a reasonable substitute that still produced real, accurate per-product data
   (title, handle, SKU, variant list, price), just without direct database-level access.

## Evidence / Validation

- [[2026-10-08_e27-batch2-quickfixes]] (evidence)
- [[2026-10-08_e27-batch2-quickfixes_validation]] (validation)
- Daily log: [[2026-10-08_daily-work-log]]
- Reply tracker: `dcvoltage-e27-model/Batch2_reply_tracker_2026-10-08.md`
- C7 title sheet: `dcvoltage-e27-model/C7_title_sheet_2026-10-08.md` + Google Sheet (link in
  tracker)
- C2 filter-value sheet: Google Sheet (link in tracker)
- Daily report table (task/user-benefit): `dcvoltage-e27-model/DC_Voltage_Daily_Report_2026-10-08.md`
- Screenshots: `dcvoltage-e27-model/screenshots/85-*.png` through `91-*.png`

## Files changed (theme, all pushed live)

`sections/main-blog-post.liquid` (G4), `sections/product-information.liquid` +
`snippets/product-information-content.liquid` (P4a breadcrumb), `templates/product.e27-model.json`
(P4b complementary products + grid fix, P3a/b/c buy box reorder/discount removal/delivery line),
`sections/model-collection-e27.liquid` (C5a ItemList, C5d FAQ numbering), `sections/header.liquid`
(C5b Organization schema), `templates/page.contact.json` (C5b tel: link fix),
`sections/hvc-products.liquid` (P6d alt-text fix). Admin-only changes (not in git): Store name
setting + 17 products' Vendor field (C5c brand), 3 product metafield definitions + 1025's own
values (C2 step 1), 1025's 3 variant option labels (P3d).

## Status

**5 of 8 done** (G6, G4, P4, P3, C5), all independently confirmed live via direct page fetch, not
screenshot-only. **G4 (originally the most blocked item) is now resolved** — no longer carried
forward as blocked. **3 items in progress** (P6, C7, C2): every no-approval-needed part is
complete; the remainder is genuinely waiting on Thuwaraga's reply to 2 sheets and 1 message, not
on any further work from this side. Telegram reply posted with current status; will finalize once
she responds.
