# Validation — Full Duplicate SKU Report (ledsone-de)

**Date:** 2026-07-01
**Reviewer:** Claude (automated), pending human spot-check

## Checks performed
- [x] Product/variant counts cross-checked: `productsCount` = 2,507 matches bulk export product count (2,507).
- [x] Variant count from bulk export (9,994) reconciled: 13 variants have a blank SKU (excluded from duplicate matching, as blanks aren't a real duplicate).
- [x] Duplicate detection only flags SKUs shared across **different products** (a multi-variant product legitimately reusing conventions was excluded — 9 SKU collisions were same-product and excluded).
- [x] Sales figures pulled live from ShopifyQL for the full store history (`SINCE 2015-01-01`), not estimated or copied from the prior doc.
- [x] Spot-checked 3 known SKUs from the prior `duplicate-sku-comparison` doc (`ICC35E1460-IDE`, `ICMUSHE2760-IDE`, `LDMT185E2742PK-IDE`) — same product pairs and consistent sales figures reappear in the new report (sales grew slightly, consistent with 1 week passing since 23 June).
- [x] Confirmed new report surfaces 176 SKU groups with 3–4 duplicate listings that the old doc could not represent (its schema only had columns for A/B).

## Status: PASS

## Next step
Human review of `duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report.docx` to decide which duplicate/weaker listings should be merged, redirected, or archived.
