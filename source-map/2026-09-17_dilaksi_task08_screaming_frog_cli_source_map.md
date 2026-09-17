# Source Map — Screaming Frog SEO Spider CLI (Dilaksi Task 08)

Date: 2026-09-17 (updated same day — see "Integration update" and "REMOVED" below)

## REMOVED (2026-09-17, later same day)

Per explicit instruction, this Screaming Frog integration was removed
from `dm-dashboard` entirely and replaced with a Google Search Console
API-based approach instead (no local CLI dependency). The final,
currently-live implementation is the "GSC 404 URL Monitor" (Dilaksi)
task — see `2026-09-17_gsc-404-url-monitor_source_map.md` (new record,
this same folder). This file is kept for history only; nothing below
reflects the current codebase.

## Integration update (2026-09-17, later same day)

**Now integrated.** The CLI confirmed below has been wired into
dm-dashboard as the "Broken Link / 404 Monitor" Development Task
(`backend/app/dev_tasks/broken_link_monitor/`). It is invoked via
`screaming_frog.py`'s `run_list_crawl()` in Screaming Frog's list mode
only (`--crawl-list`), against a small, explicit, bounded URL list —
never an unrestricted full-site crawl (no `--max-urls` flag exists in
this CLI version, so list mode is the deliberate size-bounding
mechanism used instead). Live-tested end to end against
`https://ledsone.co.uk` on 2026-09-17: a real 2-URL crawl correctly
found and classified a deliberately non-existent product URL as a 404,
which was then enriched with real GA4/GSC/Shopify data and saved to
Postgres. See the matching implementation prompt/evidence/validation/
handover records dated 2026-09-17 (`..._task08_implementation_*`) for
full detail. This entry's original "available, not yet integrated"
content is kept below for history.

## Original entry — available, not yet integrated (superseded above)

**Screaming Frog SEO Spider CLI** — local, licensed-machine desktop tool
(not a web API). Confirmed installed and executable on this machine.

- Executable: `C:\Program Files (x86)\Screaming Frog SEO Spider\ScreamingFrogSEOSpiderCli.exe`
- Version: 22.2
- Access method: direct process invocation by absolute path (no network
  API, no PATH change needed)
- Data it can produce (once actually invoked for a real crawl — not done
  yet): crawl results including response codes, broken links (4xx/5xx),
  redirects, and the full range of SEO Spider export/report types listed
  in its own `--help` output.
- Status: **available, verified, NOT yet integrated into any pipeline or
  DM Dashboard feature.** No crawl has been run. This entry exists so a
  future Task 08 build knows the CLI is confirmed working rather than
  re-verifying from scratch.
- Licence tier (free vs paid): **not confirmed** — see the 2026-09-17
  validation record for this task.
- Credentials: none stored in AIOS. Any Screaming Frog licence
  configuration lives only in the local machine's own
  `C:\Users\PC\.ScreamingFrogSEOSpider\` config directory, never in this
  repo.

## Not yet documented (because not yet built)

- No crawl schedule, cadence, or scope has been defined — manual trigger
  only as of 2026-09-17 (see implementation handover).
- ~~No DM Dashboard endpoint or table consumes this source yet~~ —
  superseded, see "Integration update" above.

## Reused sources in this integration (no new credentials/integrations)

- **GA4** — `backend/app/google_client.py`'s `fetch_ga4_report()`, same
  property (408110563) Dilaksi's Req1/Req2/meta_audit already use.
- **GSC** — `google_client.py`'s `query_gsc()`, same site
  (`sc-domain:ledsone.co.uk`) `dilaksi.py` already uses.
- **Shopify Admin API** — `backend/app/shopify_client.py`'s `graphql()`,
  same `ledsone_uk` store every other task this session uses, read-only.
- **Postgres** — this app's own production database, new tables only
  (`broken_link_monitor_crawls`, `broken_link_monitor_issues`).

No new external source, credential, or integration was added for this
task — only the CLI (already present above) plus reuse of the four
sources listed here.
