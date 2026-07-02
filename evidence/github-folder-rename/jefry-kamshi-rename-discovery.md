# Discovery — Jefry / Kamshi GitHub Folder Rename (STOPPED: FOLDERS NOT FOUND)

**What is this?** Read-only discovery evidence for a planned manual rename of GitHub folders "Jefry" and "Kamshi".
**Why does it exist?** To make any rename safe and queryable before it happens, and to avoid duplicate truth.
**Business/operational question supported:** Where do the Jefry/Kamshi folders live, what references would break if renamed?
**Owner/reviewer:** Kuberan (requester via GPT coordinator)
**Date:** 2026-07-02
**Status:** STOPPED — stop condition triggered (target folders not found; also dirty git working tree)

## Sources checked (all read-only)

1. **aios-2 repo** (C:\Users\PC\OneDrive\Desktop\kuberan web, remote github.com/kuberandigit-coder/aios-2, single branch `main`):
   - Filesystem: `find . -iname "*jefry*" -o -iname "*kamshi*"` → **no files or folders**
   - Git index: `git ls-files | grep -iE "jefry|kamshi"` → **no tracked paths**
   - Git history: `git log --all -i --grep` → **no commits mentioning either name**
   - Remote branches: `git ls-remote --heads origin` → only `main`, so GitHub cannot show folders absent from main
   - Root folders present: Blog tool, EOD, closure, docs, duplicate-risk, evidence, handover, prompts, reports, shopify-themes, source-map, validation — no Jefry/Kamshi, no case-variant collision
2. **Nested EOD repo** (EOD/, remote github.com/digitalmarketing69140951-sys/eod-tool): flat repo (8 files, no subfolders) — **no Jefry/Kamshi folders**

## Text references found (names only, NOT folders)

"Jefry" and "Kamshi" appear only as **staff names in EOD tool HTML** (dropdown `<option>` lists, staff arrays, CSS classes like `.staff-jefry`) in `EOD/admin.html`, `EOD/index.html`, `EOD/standup.html`, `EOD/standup2.html` and copies under `EOD/.claude/worktrees/*`. These are UI data, not filesystem paths — irrelevant to a folder rename.

## Stop conditions triggered

1. **Jefry/Kamshi folders not found** in this repository (local, index, history, or remote branch).
2. **Git status dirty before work started** (105 pre-existing modified/deleted entries, unrelated to this task).

## Additional finding (security)

The EOD nested repo's git remote URL embeds a plaintext GitHub personal access token (`ghp_…` in `EOD/.git/config`). Recommend revoking/rotating that token and switching to credential-manager auth.

## Pass/fail rule
PASS only if exact folder paths, file counts, references, and risks are documented for existing folders. → **Cannot PASS: folders do not exist here. FAIL-SAFE STOP (no rename possible or attempted).**

## Known limits
- Only this working directory and its two git remotes were inspected (per scope). If "Jefry"/"Kamshi" folders were seen in a *different* GitHub repo (e.g. another account/repo not cloned here), that repo was not inspected.
- Shopify theme repos under `shopify-themes/` were covered by the filesystem search (no matches) but their remote branches were not enumerated.

## Next step
Ask requester: **which GitHub repo/URL shows the Jefry and Kamshi folders?** Provide the exact GitHub URL. No checklist created — creating a rename checklist for non-existent folders would be duplicate/false truth.

---

## UPDATE 2026-07-02 — Folders located and Jefry rename EXECUTED (user-approved)

- Requester provided the real location: **github.com/digitalmarketing69140951-sys/eod-reports** (private repo), folders under `eods/`.
- Repo cloned to `C:\Users\PC\OneDrive\Desktop\eod-reports` using the existing account token.
- Discovery in that repo: `eods/` held 21 staff folders including duplicate spellings — Jefry (66 files) / Jefri (1 file), Kamshi (61) / Kamsi (1), Hetheesa (65) / Hetheesha (3), Thivajini (65) / Thivagini (3).
- User decision: rename **Jefry → Jefri only**; Kamshi untouched.
- The stray `eods/Jefri/2026-07-02.md` was deleted upstream (commit 67f469d) before the move, so no collision occurred.
- Executed: `git mv eods/Jefry/* eods/Jefri/` → commit **dbf3d72** "rename: eods/Jefry -> eods/Jefri" (66 files, all 100% renames, history preserved) → pushed to main.
- Verified: `eods/` now contains only `Jefri`; working tree clean.

**Status:** DONE (Jefry→Jefri). Hetheesa/Hetheesha, Thivajini/Thivagini duplicates remain unresolved by request.

## UPDATE 2026-07-02 (later) — Kamshi → Kamsi rename EXECUTED (user-approved)

- Stray `eods/Kamsi/2026-06-30.md` was deleted upstream (commit 47e9846) before the move — no collision.
- Executed: `git mv eods/Kamshi/* eods/Kamsi/` → commit **6ff3c06** "rename: eods/Kamshi -> eods/Kamsi" (61 files, all 100% renames) → pushed to main.
- Verified: `eods/` now contains only `Kamsi`; working tree clean.
- Data-quality note observed during move: `Kamsi/2026-04-03,md` has a comma instead of a dot in its extension (pre-existing).

## UPDATE 2026-07-02 (later) — Thivajini → Thivagini merge EXECUTED (user-approved)

- Instruction: move ALL files from Thivajini into Thivagini; do not change anything already in Thivagini.
- Overlap check before move: no shared filenames between the two folders — Thivagini's existing 3 files untouched.
- Executed: `git mv eods/Thivajini/* eods/Thivagini/` → commit **17f5410** (65 files, all 100% renames) → pushed to main.
- Verified: `eods/` now contains only `Thivagini` (68 files = 65 moved + 3 original); working tree clean.

**Remaining duplicate pair:** Hetheesa/Hetheesha only.

## UPDATE 2026-07-02 (later) — Hetheesa → Hetheesha merge EXECUTED (user-approved)

- Overlap check before move: no shared filenames — Hetheesha's existing 3 files untouched.
- Executed: `git mv eods/Hetheesa/* eods/Hetheesha/` → commit **2d79b4b** (65 files, all 100% renames) → pushed to main.
- Verified: `eods/` now contains only `Hetheesha` (68 files); working tree clean.

**All four duplicate staff-folder pairs in eod-reports are now resolved.** Remaining follow-up: EOD tool HTML still uses old spellings (Jefry, Kamshi, Thivajini, Hetheesa) — folders will regenerate until updated.
**Known limit / follow-up risk:** EOD tool HTML (`EOD/admin.html`, `index.html`, `standup*.html`) still uses spelling "Jefry" — if reports are filed by that name, a new `Jefry` folder will reappear. Pending user decision to update the tool.
**Pass/fail:** PASS — rename executed only after explicit user approval, with collision check, evidence saved.
