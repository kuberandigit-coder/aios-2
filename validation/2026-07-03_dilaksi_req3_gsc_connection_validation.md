# Validation — Dilaksi Req 3: GSC Connection Investigation

- **Title:** Validation of GSC connection research · **Purpose:** confirm findings are evidence-based and secret-free
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Requirement number:** 3 · **Owner/reviewer:** Kuberan
- **Business question:** GSC Impressions for Req 3 · **Current connector status:** not connected (verified, not assumed)

| Check | Expected | Actual | Result |
|---|---|---|---|
| Connector status verified | inspected, not guessed | session MCP list + ~/.claude.json + .mcp.json checked; no GSC connector | PASS |
| Existing infra assessed | reuse over rebuild | GA4 service account + installed Google API libs identified and live-tested | PASS |
| Root cause proven | exact blocker known | live 403: "API has not been used in project 1028134974687... disabled" — precise, actionable | PASS |
| Setup steps documented | exact, Windows-ready | 2 steps with exact URLs + exact email + exact permission level | PASS |
| Permissions minimal | read-only | webmasters.readonly scope + GSC "Restricted" role | PASS |
| Query plan for URL/Impressions/12m/exact page | documented + runnable | test script pre-loaded with the 5 Req 3 URLs, equals-filter on page dimension | PASS |
| No secrets exposed | zero keys/tokens in files or output | only service-account email (public identifier) + key file path documented | PASS |
| No live settings changed | read-only investigation | only a read-only sites().list() test call was made | PASS |

- **Setup steps found / Permissions / Risks:** see evidence · **Evidence path:** `evidence/dilaksi/2026-07-03_dilaksi_req3_gsc_connection_evidence.md`
- **Status:** PASS · **Next step:** owner does the 2 steps → run test script
- **PASS/FAIL rule:** FAIL if credentials exposed, setup unclear, or evidence missing — none occurred. **PASS**
