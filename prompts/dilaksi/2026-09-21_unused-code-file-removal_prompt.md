# Prompt — Find and Remove Unused Code Files

Date: 2026-09-21
Repo: dm-dashboard

## Original request (verbatim, condensed)

User asked to find unused code files across the dm-dashboard system (backend `.py` and frontend `.jsx`/
`.js`), same rigor as an earlier unused-database-table audit (grep-verified, never guessed). After the
audit produced a list of 7 unused files, user was asked whether to remove all 7 or only the genuine
accidental leftovers (3 of the 7 were documented in code comments/git history as intentionally kept, not
accidentally orphaned). User chose to remove only the 4 genuine leftovers and asked for AIOS to be updated
for this action.
