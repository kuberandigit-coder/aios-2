# Claude Code Setup Prompts

**Date:** 2026-06-12

Created reusable first-message setup prompts so a new Claude Code instance behaves identically.

## 1. Kuberan's setup prompt
For Kuberan's new Claude purchase. Includes all rules: no-push-without-permission, dated md folder, daily-log no-duplicates, per-task md files, "done for today" → aios-kuberan, "push blog tool" → blog-builder, repo list (blog-builder, aios-kuberan, loyalty-dashboard-de), and memory source-of-truth folder.

Setup steps on new machine:
- Copy folders to same paths (especially `website technical - Kuberan\claude-memory\`).
- Add git remotes: `origin` → blog-builder, `aios` → aios-kuberan; sign in to GitHub.

## 2. Piranav's setup prompt (coworker)
Same structure, adapted: own folder `website technical - Piranav`, his own repos, NO blog tool section. Placeholders `<< >>` for his repo URLs / paths to fill in before pasting.

## Notes
Both prompts were shared in chat. Can be saved as `KUBERAN_CLAUDE_SETUP.md` / `PIRANAV_SETUP.md` if a standing file copy is wanted.
