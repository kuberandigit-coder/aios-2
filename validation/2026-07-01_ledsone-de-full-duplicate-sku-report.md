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
Human review of `duplicate-risk/2026-07-01_ledsone-de-full-duplicate-sku-report_v2.docx` to decide which duplicate/weaker listings should be merged, redirected, or archived.

## Report layout revision (post-delivery)
User flagged that the `#` and `All-time Orders` columns were clipped in the first version (table wider than the landscape page). Fixed by narrowing Handle/Product Title/Sales columns and widening `#`, bringing total column width to 10.0in within the 10.3in usable landscape area. Saved as `_v2.docx` because the original filename was locked open in Word at the time of the fix.
