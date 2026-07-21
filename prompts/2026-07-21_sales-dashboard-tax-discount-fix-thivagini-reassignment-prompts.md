---
title: Reusable prompts — Gross Sales tax/discount bug fix, No-Journey-Data reassignment
date: 2026-07-21
type: prompt-log
---

# Purpose
Reusable prompt patterns and diagnostic techniques from today's second session block, for future Shopify sales-figure reconciliation or attribution-gap investigations.

# Prompt 1 — User spotting a real report mismatch
> "these amunt withut the tax and shiping, in shopify with tax and shipping showing total is 5187 or something" (with a Shopify Sales report screenshot)

**When to reuse:** whenever a user provides a screenshot of Shopify's own Sales report to cross-check a dashboard figure. Don't assume it's just a "different definition" — verify with a raw single-order dump first (`debugOrderRaw=<order name>`) before concluding anything, since it may be a real calculation bug (as it was here: missing order-level discount allocation + tax wrongly included in tax-inclusive-pricing stores).

# Prompt 2 — Root-causing a gross sales bug via one order
Technique used: pick ONE order flagged as suspicious (gross > order total, which is structurally impossible unless something's wrong), dump its raw GraphQL fields (`originalUnitPriceSet`, `discountedTotalSet`, `currentTotalDiscountsSet`, `taxLines`), and do the arithmetic by hand to find which field doesn't behave as expected. This found two independent bugs from a single order (`LSFR1366`).

# Prompt 3 — Attribution cross-check with the CORRECT time window
> "check the clicks 90 days ago from order placed dat in shopify"

**When to reuse:** whenever cross-referencing Shopify orders against Google Ads product/campaign click data. Always use a **per-order 90-day-before-purchase-date window** (Google's real attribution window), not a same-calendar-month check — the same-month check undercounts real matches and overstates the "no ad connection" bucket. Build via a single SQL query with a `VALUES` list of (order_name, product_id, order_date) joined against `product_performance` with `date BETWEEN order_date - INTERVAL '90 days' AND order_date`.

# Prompt 4 — Explicit reassignment decision after review
> "these belongs to thivajini so get these order details from shopify and add to thivajini and remove from hetheesa"

**When to reuse:** template for hardcoding a manually-reviewed reassignment list into the shared API file (a `Set` of order names + an explicit exclusion/inclusion check in both sides' filters) rather than trying to encode the heuristic as a live rule — keeps the decision auditable and reversible, and should always be routed into a distinctly labeled sub-channel (e.g. "No Journey Data (Ad-Click Matched)") rather than silently merged into an existing bucket, since it's a heuristic not a confirmed attribution.

# Prompt 5 — Diagnosing an unexpected production 404 / "not valid JSON" error
> "please fix this and smooth and need to get the data fast now very slow" (with a screenshot showing a JSON-parse error)

**When to reuse:** an error like "Unexpected token 'T', 'The page c'... is not valid JSON" is Vercel's HTML 404/error page being parsed as JSON, not an actual slowness/timeout. Check `vercel inspect --logs <deployment-url>` on the currently-aliased production deployment first — if it shows "Cloning github.com/..." with an unfamiliar function list, a connected GitHub repo's auto-deploy has silently overwritten the CLI-deployed version. Fix: redeploy from the correct local directory immediately.
