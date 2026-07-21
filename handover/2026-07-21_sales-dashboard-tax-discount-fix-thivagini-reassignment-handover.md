---
title: Handover — Gross Sales tax/discount fix, No-Journey-Data reassignment, deployment recovery
date: 2026-07-21
type: handover
---

# Purpose
Continuation notes for anyone (including future-session Claude) picking up this work after today's second block.

# State at end of this block
- Gross/Net Sales calculation bug fixed store-wide (missing order-level discounts + tax wrongly included in Gross Sales for this VAT-inclusive-pricing store). Verified within ~0.3-0.4% of Shopify's own report for May 2026.
- New "Order Total (incl. tax + shipping)" card live on Hetheesha and Thivagini's tabs — exact match to Shopify's Total Sales.
- 41 France "No Journey Data" orders (Jan–Jul) permanently reassigned Hetheesha → Thivagini, kept in a distinct labeled channel "No Journey Data (Ad-Click Matched)".
- Production outage (unrelated GitHub auto-deploy from a connected repo overwrote the live site) diagnosed and resolved by redeploying from local.
- Snapshots generated for Hetheesha/Thivagini (all 6 closed months, previously none existed) and Thasitha (May/June, previously missing; Jan–Apr regenerated with the fix).

# What the next session needs to know

## Open risks / decisions pending
1. **GitHub auto-deploy conflict — NOT resolved.** The Vercel project for `digital-marketing-member-pages` is connected to `github.com/digitalmarketing69140951-sys/Staff-requirements`, which has its own automated daily commit (`chore: auto-update Jackshan dashboard`, via a GitHub Actions workflow) that can silently redeploy and overwrite our CLI-deployed production build at any time — it already did once today. The user has not yet decided whether to disconnect this auto-deploy trigger. **If a future session sees unexplained 404s or unfamiliar function names in a `vercel inspect` output, this is almost certainly the cause — redeploy from local immediately, don't assume it's a new bug.**
2. **Mahima/Jeffri's already-cached snapshots were NOT regenerated** with today's tax/discount fix — their historical months' Gross/Net Sales figures are still using the pre-fix (overstated) calculation. Not yet requested by the user; flag if exact historical accuracy on those tabs becomes important.
3. Temporary diagnostic query flags left in the deployed API (`debugOrderRaw`, `debugFetch`, `debugRawNoFilter`, `debugConfig`, plus the earlier block's `debugAllTerms*` flags) — all opt-in only, harmless, not cleaned up yet.
4. Git commit/push — **not done**, awaiting explicit user permission per this repo's standing rule.

# Continue from here
No further block after this one today. Next session should start by checking whether the user has resolved the GitHub auto-deploy risk before assuming it's still open.
