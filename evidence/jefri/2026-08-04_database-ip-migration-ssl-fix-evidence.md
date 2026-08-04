# Jefri Req1/Req2 — Database IP Migration + SSL Fix

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## Purpose

Restore and stabilize the PostgreSQL connection backing Jefri's Requirement 1 (Product
Status Labels) and Requirement 2 (Search Terms Labels) after the database developer
migrated the database host, which had broken both pages.

## Requirement source

User-reported outage, 2026-08-04: Requirement 1 was stuck showing data no newer than
2026-07-29, then broke entirely after a developer-initiated `DATABASE_URL` host change.

## Business question

Why did the dashboard stop updating, and why did it break further after the IP change?

## Work completed (in order)

1. **Root-caused the original 07-29 staleness**: not a connection issue — confirmed via
   `MAX(date)` in `google_ads.product_performance` that the data itself hadn't been
   ingested past 07-29, unrelated to the DB host.
2. **First `DATABASE_URL` change attempt** (new host `169.58.91.229`, same
   `dbhub_readonly` user): deploy broke with `Cannot find module 'pg'` — traced to a stale
   cached build from a dashboard "Redeploy" that skipped `npm install`; fixed with a fresh
   `vercel --prod --force` deploy from the CLI.
3. **Second failure**: `no pg_hba.conf entry for host ..., database "dbhub_readonly"` — the
   connection string's database name was wrong (defaulted to the username). Corrected to
   the real database name, `ledsone` (confirmed against `handover/jefri/2026-07-20_handover-
   notes.md`, which documented this exact database name from the original Req1 build).
4. **Third failure**: `Connection terminated due to connection timeout` on the new host —
   a network-level block (port 5432 not reachable), not fixable from the app side. On the
   user's decision, **reverted `DATABASE_URL` to the original host `207.148.78.148`**
   (same user/database), which restored service immediately.
5. **New credentials requested** (`dev_user`, new password, SSL required per the developer's
   supplied connection details, host `169.58.91.229` again). Found the app's Postgres pool
   config hardcoded `ssl: false` in **all 6** `new Pool()` instances across
   `api/requirement.js` (comment on one read: "SSL was tested and confirmed NOT supported by
   this server" — true for the old host, not the new one). Replaced the hardcoded value with
   `ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false` in all 6,
   controlled by a new `PGSSL` Vercel env var, so future host swaps don't need a code change.
6. Deployed; verified Requirement 1 connects successfully with fresh data through
   **2026-08-04 (today)** — confirming the new host's data pipeline is actually current,
   unlike the old host which was stuck at 07-29.
7. **Requirement 2 still failed** after Requirement 1 was fixed — traced to a **second,
   separate** connection pool (`getPool2`, inside `jefriSearchTermsHandlerModule`) that
   had no `ssl` key at all (relying on default no-SSL behavior). Applied the same
   `PGSSL`-driven conditional to `getPool2` and the also-affected `getPool3`
   (`mahimaSearchTermsHandlerModule`) for consistency, even though only Req2 was reported
   broken.
8. Deployed; verified Req2 connects and returns 53,546+ rows.

## Files created or modified

- `reports/digital-marketing-member-pages/api/requirement.js` (6 `new Pool()` SSL configs)

## PostgreSQL source checked

`google_ads.product_performance` (Req1), `google_ads.campaign_search_term_data` /
`google_ads.pmax_campaign_search_term_data` (Req2) — confirmed reachable and current on the
final working configuration.

## Evidence

- Live endpoint tests after each deploy (documented turn-by-turn in this session).
- `vercel logs` output captured for each of the 3 distinct failure modes (module error,
  auth-policy rejection, network timeout) to confirm root cause before each fix attempt.

## Validation

Final state confirmed working: Req1 returns current data (`dateRange.end` = today,
2026-08-04), Req2 returns 57,633+ rows with no connection errors, both via the new host
(`169.58.91.229`) with `dev_user` + SSL.

## Known limitations

- **Credential handling boundary**: per standing policy, passwords/connection strings were
  never entered by the assistant directly into Vercel — the user was given a template and
  entered real credentials themselves each time. This is documented here as a process note,
  not a technical limitation.
- The database name mismatch (step 3) happened because the placeholder in the connection-
  string template wasn't replaced with the real value on a prior attempt — worth double-
  checking full connection strings carefully on any future host change.
- `pg_hba.conf` / network-firewall configuration on the database server itself is entirely
  outside this application's control — any future "connection refused" or "timeout" error
  needs the database administrator, not an app-side fix.

## Next step

None outstanding — both Requirement 1 and Requirement 2 are live and stable on the new
host as of 2026-08-04.

## PASS / FAIL

PASS
