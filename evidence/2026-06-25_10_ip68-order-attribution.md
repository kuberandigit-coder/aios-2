# 10 — IP68 Junction Box: Order-Level Attribution Deep Dive

For the IP68 Junction Box (#1, `7585585332474`), pulled all 19 April orders (18 + 1 refund) with full session / attribution data and IST timestamps.

**KEY FINDING — Shopify's "organic" classification is misleading.** Most orders flagged organic by the analytics source were actually **Google Ads PMax** on first touch. After checking each session's real first-visit + landing page:

| Classification | Orders | Revenue |
|---|---|---|
| ✅ Truly organic (no paid UTM at all) | 3 | ~£41 |
| ⚪ Unknown (no session data) | 3 | ~£63 |
| ⚠️ Mixed (Google Ads first touch, ShopPay last click) | 3 | ~£37 |
| ❌ Paid (Google Ads PMax / Meta Ads) | 10 | ~£301 |

PMax campaigns seen: `Shop_DM_PMax-46`, `SJ_TOP_20X`, `Accessories_sj`, `Klarna_P`. One Meta Ads Catalogue order, one refund (#LED49496, −£32.90).

**Implication for SEO reporting:** "organic" totals in file 09 are inflated by paid PMax traffic that Shopify mislabels. Truly organic conversions for IP68 in April = only 3 orders (~£41).
