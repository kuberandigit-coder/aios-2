# Evidence — Dilaksi Req 3: GSC Connection Investigation

- **Title:** How to connect Google Search Console for Requirement 3 GSC Impressions
- **Purpose:** Document current connector status, safest method, exact setup steps, permissions, and test plan.
- **Date:** 2026-07-03 · **Team member:** Dilaksi · **Team:** SEO · **Requirement number:** 3
- **Business question:** Pull GSC Impressions (last 12 months, exact page filter) for the Requirement 3 pages-for-removal report.
- **Owner/reviewer:** Kuberan

## Current connector status (verified 2026-07-03)
- Session MCP connectors: Shopify ✓, Google Drive ✓, PostgreSQL ✓, Vercel ✓ — **no Google Search Console connector**.
- No project `.mcp.json`; user-level `~/.claude.json` exists (no GSC entry).
- Existing Google service account (used for GA4): `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com`, Google Cloud project number **1028134974687**, key at `C:\Users\PC\.keys\ga4-service-account.json` (key NOT committed, NOT copied — path reference only).
- Python client libraries already installed and working: `google-api-python-client`, `google-auth`.
- **Live API test performed (read-only `sites().list()`):** HTTP 403 — *"Google Search Console API has not been used in project 1028134974687 before or it is disabled."* → The ONLY missing pieces are the two setup steps below; the client stack works.

## Best connection method (chosen): reuse the existing GA4 service account
Safest and simplest — identical to the proven GA4 pattern: read-only scope, key already stored locally outside the repo, no OAuth browser flow, no new secrets created, no MCP server needed. Alternatives considered: Claude connector (none exists for GSC), community MCP servers (adds third-party code + still needs the same credentials), OAuth (interactive, token refresh burden) — all rejected.

## Exact setup steps (Windows) — 2 steps, ~3 minutes, done by account owner
1. **Enable the API** (one click): open
   `https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=1028134974687`
   while logged into the Google account that owns the `aios-ga4-reader` Cloud project → click **Enable**.
2. **Grant GSC property access:** open https://search.google.com/search-console → select the **ledsone.co.uk** property → Settings → Users and permissions → **Add user** → email: `aios-ga4-reader@aios-ga4-reader.iam.gserviceaccount.com` → permission: **Restricted** (read-only — sufficient for Search Analytics queries).
   - Note the property type: if it's a **Domain property** the site URL for queries is `sc-domain:ledsone.co.uk`; if a **URL-prefix property**, it's `https://ledsone.co.uk/`. The test script auto-detects both.
3. Wait ~2–5 minutes, then run: `python "reports\dilaksi\data\2026-07-03_req3-gsc-test-query.py"`

## Permissions required
- Google Cloud: Search Console API **enabled** on project 1028134974687 (no new IAM roles needed — service account auth is via its own key).
- GSC: service account email added to the ledsone.co.uk property with **Restricted** (read-only) permission. Full permission NOT needed.
- Scope used in code: `https://www.googleapis.com/auth/webmasters.readonly` (read-only).

## How Claude will query URL / Impressions / 12 months / exact page
`searchanalytics().query()` with: `startDate`/`endDate` = today−365 → today; `dimensions: ["page"]`; `dimensionFilterGroups` filter `{dimension: "page", operator: "equals", expression: "<exact URL>"}`; impressions/clicks summed from rows. Ready-made script: `reports/dilaksi/data/2026-07-03_req3-gsc-test-query.py` (pre-loaded with the 5 Requirement 3 URLs).

## Security confirmation
No keys, tokens or secrets were read, displayed, saved or committed. Only the service-account **email address** (public identifier, required for the grant step) and the key **file path** are documented. No GSC/GA4/Shopify/PostgreSQL settings were modified.

- **Setup steps found:** yes (2 steps, above) · **Current connector status:** not connected; stack ready
- **Files created:** this file + prompt/validation/closure/handover/source-map + test script
- **Evidence path:** this file · **Validation result:** PASS (see validation)
- **Risks:** none material — read-only scope, restricted permission; only risk is granting Full instead of Restricted (unnecessary)
- **Status:** documentation complete; awaiting the 2 owner actions · **Next step:** owner performs steps 1–2, then run test script; on success, fill GSC Impressions column in Req 3 report
- **PASS/FAIL rule:** PASS if method, permissions, steps and test plan documented without exposing secrets. **PASS**
