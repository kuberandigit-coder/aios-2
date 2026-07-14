---
task: SUK-R3 Slow-Moving Stock — Shopify Token Scope Continue Prompt
date: 2026-07-14
team_member: Sukirtha
requirement_id: SUK-R3
---

## Purpose
Reusable prompt to resume SUK-R3 deployment after it was blocked on a
missing Shopify `read_inventory` scope, mid-way through the user
generating a replacement token via a local OAuth helper script. Paste
this into a new session to continue.

## Context

Working directory: `C:\Users\PC\OneDrive\Desktop\kuberan web`

**SUK-R3 (Slow-Moving Stock Identification)** was fully built and deployed
to Vercel production:
- `reports/digital-marketing-member-pages/pages/sukirtha.html` — Requirement
  3 tab added (Req1/Req2 preserved and confirmed working).
- `reports/digital-marketing-member-pages/api/sukirtha-req3-slow-moving-stock.js`
  — new serverless endpoint, paginated read-only Shopify Admin GraphQL
  (products/variants/inventory + 90-day orders/line-items, joined by
  Variant ID).
- Deployed via `vercel --prod` from `reports/digital-marketing-member-pages/`.

**Blocker hit on first live test**: the endpoint returned HTTP 500 —
```
Access denied for inventoryLevels field. Required access: `read_inventory` access scope.
```
The `SHOPIFY_ADMIN_TOKEN` Vercel env var (originally created for SUK-R2,
which only needed `read_products`) does not have `read_inventory`. SUK-R2
itself is unaffected and still returns 200 live.

**Fix in progress**: user added the `read_inventory` scope to the custom
app in Shopify Admin (Settings → Apps → Develop apps → that app →
Configuration). To get a fresh token reflecting the new scope, the user is
running a local OAuth helper script:
- `C:\shopify-token\server.js` (rewritten/cleaned by this session — the
  user's first paste got corrupted/duplicated, now fixed).
- Requests scopes: `read_products,read_orders,read_inventory`.
- Contains the app's `CLIENT_ID` and `CLIENT_SECRET` in plain text —
  deliberately kept out of the git repo, lives only at
  `C:\shopify-token\` on the user's machine (see that file directly for
  values; never copy them into any AIOS doc).
- Hit a port conflict: `localhost:3000` was already occupied by an
  unrelated local project (a "Sri Lanka Traffic Portal" dev server). User
  was given steps to find/kill that process (`netstat -ano | findstr :3000`
  then `taskkill /PID <pid> /F`) and retry `node server.js`.

**Not yet done when this session ended**: confirmation that the OAuth flow
completed and a new token was generated.

## Do this

1. Ask the user whether they completed the OAuth flow in
   `C:\shopify-token\server.js` and have a new Shopify Admin API token
   (starts `shpat_...`) with `read_products,read_orders,read_inventory`
   scopes. If not, help them finish that first (port conflict resolution,
   then visit `http://localhost:3000`, click Authorize, approve, copy the
   token shown).
2. Once you have the new token, update the Vercel env var:
   ```
   cd "C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages"
   npx vercel env rm SHOPIFY_ADMIN_TOKEN production   (confirm removal)
   printf '<new token>' | npx vercel env add SHOPIFY_ADMIN_TOKEN production
   ```
   (Ask the user for explicit confirmation before running the secret-store
   write, per this session's earlier auto-mode classifier behavior — it
   required an explicit go-ahead the first time a token was stored.)
3. Redeploy: `npx vercel --prod` from the same directory.
4. Re-test the SUK-R3 endpoint:
   ```
   curl -s "https://digital-marketing-member-pages.vercel.app/api/sukirtha-req3-slow-moving-stock" -w "\nHTTP %{http_code}\n"
   ```
   Expect HTTP 200 with a `summary`/`rows` JSON body this time.
5. Also re-verify SUK-R2 didn't regress:
   ```
   curl -s -o /dev/null -w "%{http_code}\n" "https://digital-marketing-member-pages.vercel.app/api/sukirtha-req2-duplicate-check"
   ```
6. Once SUK-R3 returns real data, update all `evidence/sukirtha/SUK-R3-*.md`,
   `validation/sukirtha/SUK-R3-validation-report.md`,
   `reports/sukirtha/SUK-R3-completion-report.md`, and
   `vercel/sukirtha/SUK-R3-deployment-readiness.md` files (append, don't
   overwrite) with the real Product/Variant/Slow-Moving counts, replacing
   the "Pending live run" placeholders.
7. Git commit/push still requires separate explicit written approval per
   this requirement's own instructions — do not push without asking.

## Status
Blocked on Shopify token scope; user mid-flow generating a replacement
token via a local OAuth script when this session ended.

## Next step
Paste this prompt to continue once the user has (or is ready to get) the
new `read_inventory`-scoped Shopify token.
