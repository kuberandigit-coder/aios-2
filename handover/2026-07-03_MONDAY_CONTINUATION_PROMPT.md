# CONTINUATION PROMPT — Monday 2026-07-06 (state as of Friday 2026-07-03 EOD)

**Give this file to Claude Code as the first message on Monday:**
`Read and follow C:\Users\PC\OneDrive\Desktop\kuberan web\handover\2026-07-03_MONDAY_CONTINUATION_PROMPT.md — continue from there. Follow CLAUDE.md AIOS rules.`

**Working dir:** `C:\Users\PC\OneDrive\Desktop\kuberan web` (private repo kuberandigit-coder/aios-2, main, pushed through `3e107a7`).
**Daily log for Friday:** `docs/2026-07-03.md` (14 tasks, all closed & live). Detailed log: `docs/2026-07-03_dilaksi-req3-first-phase.md`.

## Everything LIVE at https://digital-marketing-member-pages.vercel.app
- **Dilaksi R1/R2/R3** — R3 now covers ALL 473 live collections (GA4/GSC/Semrush/nav/HTTP data, 5 filters, 15 zero-signal removal candidates). Builder: `reports/dilaksi/data/2026-07-03_req3-allcol-page-builder.py`. Prompts: `prompts/dilaksi/2026-07-03_req3_all_collections_prompts.md`.
- **Kamsi R1** — Slow-Moving Products, FULL store (13,866 SKUs, 4,115 slow, paginated/fast, Seasonal column removed). Builder: `reports/Kamsi/data/2026-07-03_kamsi_req1_page_builder.py`.
- **Kamsi R2** — Low CTR pages, June 2026 GSC (1,385 pages, 1,324 low). Pipeline: `2026-07-03_kamsi_req2_gsc_fetch.py` → `2026-07-03_kamsi_req2_page_builder.py`.
- **Hetheesha R1** — Piranav's ledsone.fr top-selling report; index cards for Kamsi/Hetheesha are Dilaksi-style expanders.

## Team setup (new since the old handover)
- **Shared repo:** `digitalmarketing69140951-sys/Staff-requirements` (private) = dashboard ONLY. Piranav works there; Kuberan's Claude syncs by copying changed dashboard files into a shallow clone and pushing (see deploy note below). ALWAYS `git fetch` the shared repo & integrate Piranav's work before pushing — he pushed hetheesha req1 on Friday and more may land over the weekend. Never force-push over his commits without merging them in first.
- **Piranav onboarding:** `handover/2026-07-03_piranav_onboarding_prompt.md` (+ send him the key file privately). May or may not be set up yet — ask Kuberan.

## DEPLOY — critical knowledge
Vercel is git-connected to Staff-requirements, BUT deployments are **BLOCKED for unauthorized git authors** (this looked like "stuck builds" all Friday; root cause proven via API `readyState: BLOCKED`).
- **Working path:** commit with author `digitalmarketing <digitalmarketing69140951@gmail.com>` and push to Staff-requirements main → auto-deploys in ~10s. Pattern: shallow-clone the shared repo to /tmp, copy changed files from `reports/digital-marketing-member-pages/`, commit with `git -c user.name=digitalmarketing -c user.email=digitalmarketing69140951@gmail.com commit`, push.
- CLI fallback: `vercel deploy --prod --yes` in the dashboard folder (watch for stuck BLOCKED deployments jamming the 1-slot queue; `vercel rm <url> --yes` clears them).
- **Pending Kuberan action:** approve kuberandigit-coder + Piranav's git authors once in the Vercel dashboard → then normal pushes deploy for everyone.
- Deploy only with Kuberan's approval unless he asks.

## Connectors (all working Friday)
GA4 + GSC: one service-account key `C:\Users\PC\.keys\ga4-service-account.json` (GA4 property 408110563; GSC sc-domain:ledsone.co.uk). Shopify/Semrush/Postgres: MCP connectors on this Claude account. PostgreSQL: read-only; refreshed daily ~08:10; key tables: public.order_transaction (all channels, fresh daily), public.inv_final_stock (warehouse stock), google_search_console.* (GSC mirror, matches API exactly).

## Open items for Monday (likely starting points)
1. **Piranav sync** — fetch Staff-requirements, merge any weekend work into private repo, update index cards for any new member reports.
2. **Dilaksi Req 3 Recommended Action column** — blocked on Kuberan-approved business rule (never invent).
3. **Dilaksi Req 2 Profit Margin** — blocked on COGS landing in PostgreSQL (check development.sku_cogs).
4. **Kamsi R2 monthly rerun** — due early August for July data (not Monday).
5. **Vercel author approvals** — remind Kuberan (one-time dashboard action).
6. New member requirements as Kuberan assigns (follow the Kamsi Req 1/2 prompt structure: duplicate check → PG discovery → connector data → Dilaksi-style page → AIOS files → deploy on approval).

## Guardrails (unchanged)
Read-only connectors · never invent data or business logic · AIOS files per task (evidence/validation/closure/docs + commit/push) · PASS/FAIL + RAG in reports · deploy with approval · pull/fetch before working (two writers now!).
