## Purpose
Fix bug: when Sajeepan clicked "My Work Tracker" in his own sidebar, the page full-page-navigated to monitor.html and displayed the ADMIN-style Staff Monitor UI (navy admin sidebar with Admin Dashboard/Staff Monitor nav links, sign-out, who-badge) plus the multi-staff tab bar — instead of just showing his own tracker inside his own page's sidebar.

Reported by user (verbatim): "INSIDE THE SAJEEPAN PAGE IN MY WORK TRACKER SHOWING ADMIN SIDE ALL PEOPLE TRAKERS SHOWING FOR SAJEEPAN ONLY HIS" / "NO NEED THIS SILDE BAR SOW HIS SIDE BAR WITH HIS TRACKER ONLY"

## Root cause
`sajeepan.html`'s "My Work Tracker" link used a plain `<a href="monitor.html">` (no `data-tool` attribute), unlike every other tool link on the page (EOD Tool, Blog Tool, Sales 2026), which all use `data-tool="..." data-fulltool="1"` to open inside Sajeepan's own iframe/sidebar shell. This caused a full page navigation to monitor.html, which renders its own separate admin-style sidebar and tab bar unconditionally, regardless of admin/non-admin role.

Note: the underlying data (`visibleStaff` filtering in monitor.html) was already correctly restricted to only the logged-in user's own tracker — the bug was purely visual/structural chrome, not a data leak.

## Fix
1. `pages/sajeepan.html` — changed the "My Work Tracker" link to `href="monitor.html?embed=1" data-tool="monitor.html?embed=1" data-fulltool="1"`, matching the same iframe-embed pattern used by EOD Tool / Blog Tool, so it now opens inside Sajeepan's own existing sidebar shell instead of navigating away.
2. `pages/monitor.html`:
   - Added detection of `?embed=1` in the auth bootstrap script, adding an `mn-embed` class to `<html>`.
   - Added CSS: `html.mn-embed .sb, html.mn-embed .tog { display:none; }`, `html.mn-embed .main { margin-left:0 !important; }`, `html.mn-embed .tab-bar-wrap { display:none; }` — hides monitor.html's own admin sidebar, sidebar toggle, and the tab bar when embedded.

## Files changed
- `reports/digital-marketing-member-pages/pages/sajeepan.html`
- `reports/digital-marketing-member-pages/pages/monitor.html`

## Evidence
- Deployed to production: https://dm-dashboard.vintageinterior.co.uk (deployment dpl_8UE6bhVdJHEQ912Y8pQevAU4dmDP, READY)
- Verified live HTML contains `mn-embed` (monitor.html) and `monitor.html?embed=1` (sajeepan.html) via curl against the production URL.
- Committed and pushed to both repos:
  - Staff-requirements (staff/main): commit 7370692
  - aios-2 (origin/main): commit d97dc29

## Status
PASS — deployed and verified live.

## Reviewer
Kuberan (pending confirmation from live click-through as Sajeepan)

## Next step
Have Sajeepan (or an account with his staff_key) click "My Work Tracker" on his own page in production and confirm the admin sidebar/tab bar no longer appear and only his tracker content is shown.
