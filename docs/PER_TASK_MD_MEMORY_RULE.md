# Memory Rule Added — Per-Task MD Files

**Date:** 2026-06-15
**Owner:** Kuberan

## Objective
Improve the memory/documentation workflow so that completed work is captured as individual, named files — not just bundled into the daily log.

## Change Made
Added a new permanent rule to the memory source of truth (`website technical - Kuberan\claude-memory\`):

**Per-Task MD Files** — On "done for today", do NOT only write the daily log. For EVERY task or change completed during the day, create a SEPARATE `.md` file named after that task (e.g. `BULLET_INTRO_TYPOGRAPHY_FIX.md`), containing Objective, Root Cause, Files Changed, Changes Made, Validation, Outcome. The daily log then summarizes and LINKS each per-task file.

Also confirmed the related **daily-log no-duplicates** rule: each task appears once only.

## Files Changed
- `claude-memory\feedback_per_task_md_files.md` (new rule)
- `claude-memory\MEMORY.md` (index updated)

## Validation
- Rule applied immediately: today's work (2026-06-15) is documented as separate task files plus a linking daily log.

## Outcome
- Every completed task now produces its own standalone, named markdown file.
- Individual tasks are easy to find, reference, and reuse.
