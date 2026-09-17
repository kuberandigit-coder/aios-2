# Dilaksi Task 08 — Broken Link / 404 Monitor — CLI Setup (Original Prompt)

Date: 2026-09-17

This is the original task request, preserved verbatim. It covers ONLY the
Screaming Frog SEO Spider CLI setup/verification step, not the Task 08
feature build itself.

---

TASK: Set up and verify Screaming Frog SEO Spider CLI for Dilaksi Task 08 — Broken Link / 404 Monitor.

AIOS ROOT (as given):
C:\Users\PC\OneDrive\Desktop\kuberan web

IMPORTANT: Screaming Frog SEO Spider already installed. Start Menu shortcut:
C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Screaming Frog SEO Spider.lnk

OBJECTIVE: Find the actual Screaming Frog installation/executable behind
this shortcut and make the CLI usable from Claude Code.

Explicit boundaries for this task:
- DO NOT build Dilaksi Task 08 yet.
- DO NOT perform a full ledsone.co.uk crawl yet.
- DO NOT modify the DM Dashboard application.
- DO NOT change production code.
- DO NOT expose or store licence keys, passwords, API keys, tokens, or credentials.

Phases requested:
1. Locate the real installation (resolve the .lnk shortcut, find
   ScreamingFrogSEOSpiderCli.exe, confirm it actually exists — do not
   assume the path from the shortcut alone).
2. Verify the CLI (`--help`, version, execute permission, licence/config
   status) without starting a production crawl.
3. Make the CLI accessible to Claude Code (prefer absolute path; do not
   modify the Windows PATH or make system-level changes without approval;
   create a small local test script that invokes the CLI without exposing
   credentials).
4. Run a harmless CLI verification test proving Claude Code -> Windows ->
   ScreamingFrogSEOSpiderCli.exe -> CLI responds successfully, without
   crawling ledsone.co.uk.
5. Report: shortcut target, actual install path, CLI executable path,
   version, help-test result, licence/config status, whether Claude Code
   can execute the CLI, whether PATH modification is needed, blockers, and
   the exact next step for Task 08 — with a final PASS/FAIL/BLOCKED
   readiness status.

Security: never output or save licence keys, API keys, passwords, tokens,
private keys, or database credentials. If configuration/licence exists,
report only that it exists, never its value.

Mandatory AIOS auto-update requested: search existing AIOS records first
(Screaming Frog, SEO Spider, CLI automation, crawler, crawl automation,
Broken Link, 404 Monitor, Dilaksi Task 08) before creating anything;
preserve this original prompt; save evidence of the environment/CLI audit;
create/update validation and handover; update source-map only if this
establishes Screaming Frog as a new data source; update capability only if
a reusable CLI capability is actually established (not for a simple
install check); update duplicate-risk if applicable; never store
credentials/licence secrets in AIOS; do not mark Task 08 itself as
complete (this is CLI setup/verification only).
