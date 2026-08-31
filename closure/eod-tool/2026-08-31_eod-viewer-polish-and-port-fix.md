# Closure — EOD Tool: "View EOD" popup polish + wrong-port root cause

**Date:** 2026-08-31

## Summary
Root cause of the blank/broken popup was almost certainly the browser
being pointed at port 5173, which is a different, unrelated project, not
dm-dashboard (only port 5199 is dm-dashboard's real frontend). Cleaned up
the stray dm-dashboard process that had silently drifted to 5174, and
restarted the real frontend on 5199 with `--strictPort` so this can't
happen silently again. Also fixed the actual UX issues raised regardless:
Refresh no longer wipes the visible report list (shows an inline
"Refreshing…" state instead of a full blank spinner), and the "View EOD"
button was moved from a floating bottom row to the page header's top-right,
a more standard/professional placement.

## Status
PASS. Build clean, frontend confirmed serving on 5199.

## Reviewer
Pending user confirmation at **http://localhost:5199**.

## Evidence / Validation
See evidence/eod-tool/2026-08-31_eod-viewer-polish-and-port-fix.md and
validation/eod-tool/2026-08-31_eod-viewer-polish-and-port-fix.md
