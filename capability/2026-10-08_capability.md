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
