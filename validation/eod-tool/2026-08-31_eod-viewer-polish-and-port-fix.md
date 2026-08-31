# Validation — EOD Tool: "View EOD" popup polish + wrong-port root cause

**Date:** 2026-08-31

| Check | Expected | Actual | Result |
|---|---|---|---|
| Port 5173 identity | should NOT be dm-dashboard | confirmed owned by unrelated "For Shiyamini React" project | CONFIRMED (root cause) |
| dm-dashboard's real port | 5199 only | confirmed via `Get-NetTCPConnection` | PASS |
| Stray dm-dashboard process on 5174 | removed | killed | PASS |
| dm-dashboard restarted with `--strictPort` | fails loudly on conflict instead of drifting | applied | PASS |
| Refresh keeps list visible | no full blank/spinner replace when data exists | `myRefreshing` flag added, inline "Refreshing…" indicator | PASS |
| Refresh button disabled + spinning while refreshing | yes | `disabled={refreshing}`, spinning `Icon.Refresh` | PASS |
| "View EOD" button relocated | top-right of page header | moved into `.jreq-header` flex row | PASS |
| Old bottom-floating button removed | yes | removed | PASS |
| `npx vite build` | no errors | `✓ built in 506ms` | PASS |
| Frontend serving | 5199 responds 200 | confirmed via curl | PASS |

## Status
PASS.

## Reviewer
Pending user confirmation at **http://localhost:5199** (not 5173).
