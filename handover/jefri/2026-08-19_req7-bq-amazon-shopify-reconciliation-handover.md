# Jefri Req 7 — T-07 B&Q/Amazon/Shopify Reconciliation — Handover

**Status:** Implemented, hand-validated against real live Postgres data. **NOT DEPLOYED** — awaiting explicit go-ahead per instruction #26 (discover → implement → test → validate → save evidence → save handover → confirm PASS → only then deploy).

## What's done
- New Requirement 7 tab on `pages/jefri.html` (`#req7Tab`), nav item wired, hash-restore updated.
- New backend handler `jefriReq7HandlerModule` in `api/requirement.js`, route `?fn=jefri-req7&date=YYYY-MM-DD`.
- Full evidence + validation records saved (see paths below).

## What's NOT done
- Not deployed to Vercel.
- Not live-HTTP-smoke-tested (validated via direct Postgres + manual JS trace instead — no local dev server was started this session).
- Full-day coverage of every flag path (Mixed, Amazon Not Found) not yet observed on a real live row — only 2 B&Q lines existed for 2026-08-19 at validation time; both exercised different-but-not-all paths (Correct/High on both marketplaces, and Incorrect+Not Found on the other line).

## To deploy (when approved)
1. `cd reports/digital-marketing-member-pages`
2. Confirm `git status` clean, `git fetch` + confirm local matches `origin/main`.
3. Commit + push both repos per the project's dual-repo rule (Staff-requirements is what Vercel deploys from).
4. `vercel --prod --yes --force` (bypass build cache — recurring stale-deploy issue on this project, see memory `feedback_verify_live_deploy_not_just_repo_sync`).
5. Smoke test: `curl "https://dm-dashboard.vintageinterior.co.uk/api/requirement?fn=jefri-req7&refresh=1"` — expect `count` ≥ 2 (today's known B&Q lines) and non-null `date`.
6. Open jefri.html → Requirement 7 tab in a browser, confirm the table renders and both known real lines (`LDMG95B2282PK`, `LSCY290WH+RPR44WH`) show the flags documented in the validation file.

## Key files
- `reports/digital-marketing-member-pages/pages/jefri.html` — `#req7Tab` section, `r7*` JS functions (search "Requirement 7: T-07" comment block).
- `reports/digital-marketing-member-pages/api/requirement.js` — `jefriReq7HandlerModule` (search "Jefri Requirement 7: T-07").
- `evidence/jefri/2026-08-19_req7-bq-amazon-shopify-reconciliation.md`
- `validation/jefri/2026-08-19_req7-bq-amazon-shopify-reconciliation-validation.md`
- `prompts/jefri/jefri-req-07-t07-prompt.md`

## Known risk carried over from earlier Jefri work
This same Vercel project has repeatedly reverted to stale deployments across the session history (see `evidence/jefri/2026-08-12_req4-req5-post-launch-fixes.md` and user memory `feedback_verify_live_deploy_not_just_repo_sync`). Always verify the LIVE custom domain byte-for-byte after any future deploy touching this file, not just repo sync.
