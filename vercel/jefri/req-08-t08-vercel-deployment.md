# Jefri Req 8 — T-08 — Vercel Deployment Documentation

**Status:** NOT APPLICABLE — no implementation exists to deploy.

Per the governing prompt (`prompts/jefri/req-08-t08-update-prompt.md`, §23 "No Deployment Before Validation" and §24 "Stop Conditions"), this task stopped at the discovery stage before writing any code. No changes were made to `pages/jefri.html`, `api/requirement.js`, or any other deployable file. There is nothing to deploy.

This file exists only to satisfy the mandatory AIOS folder-update requirement (§19) and to document, for traceability, that deployment was correctly withheld rather than pushing an incomplete or fabricated implementation.

See `handover/jefri/req-08-t08-handover.md` for what would need to happen before implementation (and therefore deployment) becomes possible.

---

# UPDATE — 2026-08-20: deployed

Steps 1-3 (Order Number/Value, Order Summary, Campaign+Attributed Date via Method 2) were built incrementally per Kuberan's explicit instruction and deployed to production the same day, in five separate deploy cycles as each step was validated:

1. Req8 blocked-status tab (initial visible placeholder)
2. Step 1: live Order Number + Value from Shopify Admin API
3. Column cleanup (dropped Order Total/Financial Status, tightened spacing)
4. Step 2: Order Summary from Shopify's customerJourneySummary
5. Step 3: Campaign + Attributed Date via product_performance value+bonus matching
6. Filters (Order Summary type, Attribution status, Campaign) + CSV export

**Deploy process used (standard for this project):** commit to `aios-2` (origin) → push → fetch `Staff-requirements` (staff) → copy the exact committed file content into a fresh git worktree off the current `staff/main` tip (to avoid overwriting concurrent-session commits, a recurring issue on this shared repo) → commit → rebase onto latest `staff/main` if it moved → push → `vercel --prod --yes --force` from the live working directory → verify via direct `curl` against `dm-dashboard.vintageinterior.co.uk`, not just the deploy command's own success message.

**Verified live** — API responses and rendered HTML confirmed matching, for every one of the six deploys above, including the two hand-verified real orders (`#LSDE19240`, and the €51.61 order) reproducing their exact expected attribution results from the live endpoint.

**Concurrent-session note:** during this work, another session's "repo-sync" commit briefly reverted the Req8 blocked-tab addition on `aios-2` (a race condition — their sync pulled a copy from before this session's push had landed on `Staff-requirements`). Caught via routine post-deploy verification, re-applied, redeployed. No data loss, but a reminder this repo is actively shared.
