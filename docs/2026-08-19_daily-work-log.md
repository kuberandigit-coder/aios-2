## 2026-08-19 Daily Work Log

### Task: Sajeepan "My Work Tracker" admin-sidebar bug fix
- Bug: clicking "My Work Tracker" on Sajeepan's page full-page-navigated to monitor.html, showing the full admin sidebar + all-staff tab bar instead of just his own tracker.
- Fix: converted the link to embed mode (`monitor.html?embed=1` via `data-tool`, matching EOD Tool/Blog Tool pattern), added embed-mode CSS/JS in monitor.html to hide its sidebar/toggle/tab-bar when embedded.
- Files: `pages/sajeepan.html`, `pages/monitor.html`
- Committed + pushed: Staff-requirements (7370692), aios-2 (d97dc29)
- Deployed to production: https://dm-dashboard.vintageinterior.co.uk — verified live via curl.
- Docs: evidence/validation/closure under `sajeepan/2026-08-19_sajeepan-monitor-embed-fix.md`
- Status: PASS

### Task: Removed unused cost.html page
- No other file referenced it; safe delete from both repos.
- Committed + pushed: Staff-requirements (26cf93a), aios-2 (8dde800)
- Deployed to production, verified 404 live.

### Task: Sonya perf-batch endpoint (muguntha.html Employee Performance slowness)
- Bug: each staff tab fired 40 separate HTTP requests (20 months x sales+cost) on first click — root cause of "taking too much time to load".
- Fix: new `?action=perf-batch&member=sonya` endpoint in api/muguntha.js, fetches all 20 months in one serverless invocation; muguntha.html's loadAll() uses it for Sonya's tab only (scoped per user's request — other staff tabs unchanged).
- Follow-on bug found + fixed during rollout: api/muguntha.js's maxDuration was 60s, but the batch endpoint now runs salesuk.js's live-month Shopify scan (documented 30-90s+) in-process — 60s was killing the request silently (HTTP 000, no response). Fixed by raising maxDuration to 300 (matching salesuk.js's own existing budget).
- Files: `api/muguntha.js`, `pages/muguntha.html`, `vercel.json`
- Committed + pushed: Staff-requirements (fc901a6, 83db560), aios-2 (80faf63, 6fec643)
- Deployed to production, user confirmed manually: "ok perfect i ckeck mannually now fast"
- Docs: evidence/validation/closure under `muguntha/2026-08-19_sonya-perf-batch-endpoint.md`
- Status: PASS
- Next: extend same batch pattern to Sajeepan/Kamsi/Jefri/Dilaksi tabs if requested.

### Task: Sajeepan perf-batch endpoint (extending the Sonya fix)
- Extended `handlePerfBatch()`'s allow-list (`PERF_BATCH_MEMBERS`) to include Sajeepan, same batch pattern as Sonya — no per-member special-casing needed since the batch logic was already member-agnostic.
- Files: `api/muguntha.js`, `pages/muguntha.html`
- Committed + pushed: Staff-requirements (e98e245), aios-2 (0b3411a)
- Deployed to production (dpl_7YT9mjRzMGW3A3R4kapCPZz1Hovj)
- Docs: evidence/muguntha/2026-08-19_sajeepan-perf-batch-endpoint.md
- Status: PASS (deployed; not yet manually re-confirmed by Kuberan in browser)

### Task: Deploy Jefri Req 7 (with ultrareview bugfixes)
- Req7 (B&Q -> Amazon -> Shopify SKU & Price Reconciliation), built in Kuberan's other Claude session (commit 9689fe6 on aios-2), was pending deploy.
- Before deploying, `/ultrareview` findings were fixed first (Kuberan chose "fix first" when asked): removed 3 redundant `client.release()` calls in `handleJefriReq7` (finally block already covers every exit — double-release throws), added a `mapped_sku !== sku` guard to stop `amazonBySku`/`shopifyBySku` double-counting a row when sku==mapped_sku, and removed a stray "i mean m" typo before `<!DOCTYPE html>` in staff-id-performance.html (confirmed uncommitted-local-only, never actually live). The 4th finding (`r7Init()` "never defined") was a false positive — it IS defined later in the file in a separate but same-global-scope `<script>` tag.
- This deploy also brought the entire Req7 feature into Staff-requirements for the first time (it previously only existed on aios-2, never synced to the repo Vercel actually deploys from).
- Files: `api/requirement.js`, `pages/jefri.html` (unchanged, false-positive), `pages/staff-id-performance.html`
- Committed + pushed: Staff-requirements (6b49bbf), aios-2 (c973932)
- Deployed to production (dpl_9jsD9rU2PWvfbcLjSEjGoS3rGntq), live-tested `GET /api/requirement?fn=jefri-req7` — HTTP 200, real data returned.
- Docs: evidence/jefri/2026-08-19_req7-deploy-with-ultrareview-fixes.md
- Status: PASS (API-verified; full browser UI walkthrough not yet done)

### Task: Sonya cost breakdown popup (VAT/Product Cost/Transaction Fee/Discount/Refund/Subscription Fee)
- Built clickable popup on Sonya's 2025/2026 Total Cost cells; researched actual Shopify subscription fee ($399/mo Advanced plan, found via Shopify Admin Settings > Plan, converted to £294.82 at 2026-08-19 mid-market rate, split £73.71/2025 and £58.96/2026).
- Iterated on the cost formula twice per Kuberan's corrections: (1) removed VAT/Discount/Refund from the total — Kuberan caught that Net Sales already excludes them, so summing them again double-subtracted; (2) revised again — VAT changed to a flat 20%-of-sales assumption (like Product Cost) and Discount/Refund restored as real counted costs, per Kuberan's final specification.
- Table's Total Cost cell (not just the popup) now reflects the same full formula.
- Files: `pages/muguntha.html`
- Multiple commits, final state pushed + deployed to both repos.
- Status: PASS

### Task: Root-cause fix — 243 stale/missing api/data snapshot files (the REAL cause of muguntha.html's hangs)
- While investigating why Sonya's Jan 2025 Transaction Fee showed £0.00, discovered `check-repo-sync.js` had ALWAYS skipped the `data/` directory — meaning every "FULLY IN SYNC" result for 2+ weeks was wrong for snapshot files specifically.
- 174 snapshot files were completely missing from the deployed Staff-requirements worktree (including `sales25-sonya-2025-07.json` through `-12.json`, and all Kamsi/Dilaksi/Jefri cost snapshots), 69 more were stale (missing the vat/transactionFee fields added 2026-08-07).
- This is almost certainly the TRUE root cause of the "random month hangs" chased earlier in the day via concurrency tuning (5→3→2→1) and a timeout/retry resilience layer — those were real, reasonable defensive fixes but were treating a symptom; missing snapshot files forced a live 30-90s Shopify scan for every affected month.
- Fix: synced all 243 files from aios-2 (source of truth) into Staff-requirements; fixed check-repo-sync.js to cover `api/data/*.json` (file count checked: 50 -> 542).
- Live-verified: transaction fee now correct, and all 6 previously-hanging months (2025-07 to -12) now respond in ~2s instead of 15-30s+ hangs.
- Files: `api/data/*.json` (243 files), `scripts/check-repo-sync.js`
- Committed + pushed to both repos, deployed to production, verified live.
- Docs: evidence/muguntha/2026-08-19_snapshot-sync-root-cause-fix.md
- Status: PASS

### Notes
- New standing preference: only run `vercel --prod` when the user explicitly says "deploy" — see feedback_deploy_only_on_explicit_command memory. Manual CLI deploy method confirmed as the ongoing standard (both Kuberan and Piranav deploy manually; no Git-triggered auto-deploy is set up).
- Important recurring lesson: check-repo-sync.js gaps have now caused real production bugs 4 times (Jefri Req4/hourly-cron/Req5 handlers, and this 243-file snapshot drift). Always re-run the checker after ANY session touching api/, pages/, or api/data/ — it's finally comprehensive now (542 files) but stayed silently wrong for weeks before today.
