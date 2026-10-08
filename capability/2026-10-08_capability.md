# Capabilities — 2026-10-08

## Capability — Liquid `article.handle` Includes the Blog-Prefixed Path (not just the slug)

**Date:** 2026-10-08
**Owner:** Kuberan (DC Voltage E27 Batch 2, item G4)
**Status:** Root-caused and fixed, after a multi-hour live-debugging mystery

### Capability (a documented Shopify Liquid gotcha)

In Shopify Liquid, `article.handle` on a blog article returns the **blog-prefixed** value
(e.g. `news/e27-vs-b22-vs-gu10-which-bulb-fitting-do-you-actually-need`), not just the article's
own slug. A condition written as `article.handle == 'the-slug-alone'` silently never matches —
no error, no warning, the `if` block simply never executes.

### Why this was hard to find

The surrounding symptoms (theme code confirmed byte-identical correct via both CLI push and a
direct theme-pull diff; the live page genuinely re-rendering dynamically, confirmed by editing the
article and watching its content length change by exactly the edit's size) all pointed away from
"the code is wrong" and toward a caching mystery. The actual bug was a silently-failing condition,
isolated only by temporarily forcing the condition `true` and printing `article.handle` directly
into the rendered page.

### Diagnostic technique established

**When a Liquid `if` scoped by some page property never seems to fire, temporarily force the
condition `true` and print the actual property value into the page** — this isolates "the
condition is wrong" from "the code never runs at all" far faster than guessing.

### Originating task

`evidence/dcvoltage/2026-10-08_e27-batch2-quickfixes.md`

---

## Capability — Confirm a "Duplicate Theme" Is Actually a Duplicate Before Treating It as a Safe Preview

### Capability (a documented gotcha, not a feature)

A theme named "Tinker - E27 model DRAFT" was assumed to be an isolated duplicate theme, safe to
push experimental changes to before they reached the live site. It was, in fact, **the live,
published theme** — confirmed via the `server-timing` response header's `theme;desc=` field
matching the theme ID being pushed to. Several pushes this session went straight to production
under the mistaken belief they were landing on a safe preview.

### Reusable check

**Before treating any theme as a safe duplicate/preview target, confirm via a live page fetch's
`server-timing` header (or the Shopify Admin's own theme list) which theme ID is actually serving
the live domain** — a theme's name is not reliable evidence of its publish status.

### Originating task

`evidence/dcvoltage/2026-10-08_e27-batch2-quickfixes.md`

### Standing rule this produced

Confirm with the user before every live theme push going forward, regardless of which theme is
targeted — recorded as a standing feedback rule (`feedback_confirm_before_live_push` in assistant
memory), not just a one-time correction.

---

## Capability — Single Source of Truth for "Who Owns This Product" (Mahima Req5b fix)

**Date:** 2026-10-08
**Owner:** Kuberan (dm-dashboard)
**Status:** Fixed, pushed to `dev-work`

### Capability (a documented bug class, not a feature)

Two different functions in the same file (`backend/app/staff_pages/mahima.py`) answered "is this
product Mahima's?" differently: `/req5` used the real Shopify `Mahi-ft` tag (fixed 2026-09-22),
while `/req5b` still used an older, campaign-spend-derived definition (any product with a row in
`google_ads.product_performance` under her campaign IDs) — including stray/historical rows for
products that aren't actually hers. A real product with zero ad spend leaked through on `/req5b`
while correctly being absent from the tag-based Product Ownership page.

### Fix

Made `/req5b`'s ownership function call the same authoritative, tag-based source `/req5` already
uses, instead of maintaining a second, separately-computed (and disagreeing) definition.

### Reusable lesson

**When a "who owns this" concept has already been fixed once in a codebase, grep for every other
place that same concept might be independently re-derived** — a fix applied to one endpoint
doesn't propagate to a sibling endpoint computing the same thing its own way. This is the same
class of issue as `2026-10-02_capability.md`'s 3-way sidebar-registration duplication and
`2026-10-06_capability.md`'s sidebar-visibility gotcha — multiple hand-maintained sources of the
same fact silently drifting apart.

### Originating task

`evidence/dm-dashboard/2026-10-08_mahima-req5b-product-ownership-bug_evidence.md`

---

## Capability — Fixes Don't Automatically Cross Codebases (Jefri hardcoded-campaign-list bug)

**Date:** 2026-10-08
**Owner:** Kuberan (dm-dashboard)
**Status:** Fixed, pushed to `dev-work`

### Capability (a documented bug class, not a feature)

Every Req (1-5) on Jefri's dm-dashboard page was scoped to a hardcoded 5-campaign list. The exact
same bug — campaign reporting silently scoped to a stale hardcoded ID list instead of the real,
current campaign group — had **already been found and permanently fixed once before**, in a
completely different, older project (the Vercel `digital-marketing-member-pages` dashboard,
2026-08-05): that fix confirmed Jefri's real campaigns match
`google_ads.campaigns WHERE group_name='Jefri' AND account_id=9031058245` exactly. But a fix made
in one codebase does not automatically apply to a second, independent codebase solving the same
business problem — dm-dashboard's `jefri.py` kept its own separately-hardcoded list the whole time.

### Fix

Replaced the hardcoded list with a live, cached (1h TTL) query against the same proven
`group_name`/`account_id` source, additionally scoped to `campaign_status='ENABLED'` (matching
`admin_dm_campaign.py`'s existing convention for this same group elsewhere in the codebase) —
mutated in place so every existing consumer across Req1-5 keeps working unchanged. Falls back to
the original hardcoded list if the live query ever fails.

### Reusable lesson

**When a staff member moves/has already moved from one dashboard project to another, re-check
whether a known data-correctness fix from the old project was actually ported, not just assumed
carried over.** This is the cross-project version of the same-project lesson already captured in
`2026-10-02_capability.md` and `2026-10-06_capability.md` (multiple hand-maintained sources of the
same fact drifting apart) — here the drift was between two entirely separate codebases, not two
files in the same one.

### Originating task

`evidence/dm-dashboard/2026-10-08_jefri-hardcoded-campaign-list-bug_evidence.md`

---

## Capability — A Fixed Reporting Window Can Permanently Hide Real Data With No Escape Hatch

**Date:** 2026-10-08
**Owner:** Kuberan (dm-dashboard, Jefri Req2)
**Status:** Fixed, pushed to `dev-work`

### Capability (a documented bug class, not a feature)

A report hardcoded to "last 90 days" with no date-range control at all isn't just a display
default — if the underlying data's freshness ever drifts (here: an upstream feed stopped updating
for 6 of 7 campaigns around 2026-07), the real, substantial data (161k+ rows, confirmed via direct
SQL) becomes **permanently unreachable through the UI**, with no way for the user to even discover
it exists. An old code comment had actually mis-diagnosed this as "the table is empty" — a comment
that was never re-verified once written, and was simply wrong.

### Reusable lesson

**Before trusting an old "this data source is empty/broken" code comment, re-verify it directly**
— it may describe a true finding from when it was written that's since become stale or was itself
wrong. And: **any report with a hardcoded time window should have a way to widen or shift it**,
even if the default stays narrow — otherwise a silent upstream data-freshness regression becomes
permanently invisible instead of just temporarily stale.

### Fix

Added optional `from`/`to` date params (backend) and From/To inputs (frontend) to Req2, same
convention Req1 already used on this page — default behavior unchanged, but the real data is now
reachable.

### Originating task

`evidence/dm-dashboard/2026-10-08_jefri-req2-missing-date-range_evidence.md`
