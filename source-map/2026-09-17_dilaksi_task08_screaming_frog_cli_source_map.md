# Source Map — Screaming Frog SEO Spider CLI (Dilaksi Task 08)

Date: 2026-09-17

## New source confirmed available (not yet integrated)

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

- No crawl schedule, cadence, or scope has been defined.
- No DM Dashboard endpoint or table consumes this source yet.
