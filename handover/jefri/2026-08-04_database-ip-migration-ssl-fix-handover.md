# Jefri Req1/Req2 — Database IP Migration + SSL Fix (Handover)

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## What was done

Diagnosed and fixed a chain of 3 separate outages caused by a database host migration:
missing `pg` npm module (stale cached build), wrong database name in the connection string,
and a network-unreachable new host (reverted). Once the developer supplied working
credentials (`dev_user` + SSL) for the new host, fixed a hardcoded `ssl: false` across all
6 Postgres connection pools in `api/requirement.js`, replacing it with an env-var-driven
(`PGSSL=require`) config so future host changes don't need a code redeploy for SSL alone.

## What's next

Nothing outstanding. Both Requirement 1 and Requirement 2 are confirmed live and current
(data through 2026-08-04) on the new host.

## Where to find things

- Evidence: `evidence/jefri/2026-08-04_database-ip-migration-ssl-fix-evidence.md`
- Validation: `validation/jefri/2026-08-04_database-ip-migration-ssl-fix-validation.md`
- Code: `reports/digital-marketing-member-pages/api/requirement.js` (search `PGSSL`)
- Vercel env vars: `DATABASE_URL`, `PGSSL` (Production)

## Risks / open questions

- If the database host changes again, remember: (1) SSL requirement can differ per host —
  `PGSSL` env var handles this without a redeploy; (2) always verify the full connection
  string's database name, not just the host, since a wrong db name produces a confusing
  `pg_hba.conf` error rather than a clear "database not found."
- No AIOS entry exists yet for *who* administers the Postgres server itself (host, firewall,
  `pg_hba.conf`) — worth capturing as a reference memory if this recurs.
