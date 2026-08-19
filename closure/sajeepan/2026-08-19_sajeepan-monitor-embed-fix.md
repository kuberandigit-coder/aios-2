## Purpose
Close out the Sajeepan "My Work Tracker" admin-sidebar bug fix.

## Summary
Sajeepan's "My Work Tracker" link on his own page previously full-page-navigated to `monitor.html`, exposing the admin-style Staff Monitor sidebar and multi-staff tab bar (even though the underlying tracker data shown was already correctly limited to his own). Fixed by converting the link to open embedded (via `?embed=1` + `data-tool`, matching the pattern used for EOD Tool/Blog Tool elsewhere on his page) inside his own sidebar, and adding embed-mode CSS/JS to monitor.html that hides its own sidebar, sidebar toggle, and tab bar when embedded.

## Evidence
See `evidence/sajeepan/2026-08-19_sajeepan-monitor-embed-fix.md`

## Validation
See `validation/sajeepan/2026-08-19_sajeepan-monitor-embed-fix.md`

## Status
PASS — deployed to production (https://dm-dashboard.vintageinterior.co.uk), pushed to both Staff-requirements (commit 7370692) and aios-2 (commit d97dc29). Live code verified via curl.

## Reviewer
Kuberan

## Next step
Optional: Kuberan/Sajeepan to do a live click-through as Sajeepan to visually confirm the sidebar is gone and only his own tracker shows.
