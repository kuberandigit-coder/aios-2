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

### Notes
- Left `pages/staff-id-performance.html` untouched (unrelated pre-existing local modification from Piranav's earlier sync, out of scope, not to be touched per standing instruction).
- New standing preference: only run `vercel --prod` when the user explicitly says "deploy" — see feedback_deploy_only_on_explicit_command memory. Manual CLI deploy method confirmed as the ongoing standard (both Kuberan and Piranav deploy manually; no Git-triggered auto-deploy is set up).
