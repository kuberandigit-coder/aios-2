---
title: 2026-06-29 AIOS Daily Task Prompt
date: 2026-06-29
task_name: AIOS Auto-Save Initialization and Daily Session Setup
purpose: >
  Initialize the AIOS daily tracking system for 2026-06-29.
  Inspect all approved AIOS subfolders, confirm no duplicate files exist,
  and create dated tracking stubs (prompt, daily log, evidence, closure, validation)
  so every subsequent task today auto-saves to the correct location.
source_input: User prompt submitted at session start (2026-06-29)
evidence_path: evidence/2026-06-29_aios-setup.md
status: OPEN — session in progress
reviewer: Varmen / Kuberan
pass_fail_rule: >
  PASS if all 5 dated stubs are created in correct folders with no duplicates.
  FAIL if any file lands outside the approved subfolder or duplicates an existing file.
next_step: User begins task work; all completions auto-save to today's evidence and daily log.
known_limits: >
  EOD folder contains HTML reports only (not markdown daily logs).
  No "logs" or "daily_logs" subfolder exists — docs/ is the canonical daily log location.
---

## Original Task Prompt (verbatim)

You are working inside:

  C:\Users\PC\OneDrive\Desktop\kuberan web

Staff/Team: Kuberan
Parent Domain: Website Tec team
Coordinator: Varmen
Repository: https://github.com/kuberandigit-coder/aios-2

Objective:
While I work on today's task, automatically save all useful task notes, evidence, prompts,
findings, and closure details into the correct existing folders inside the approved Mini-AIOS subfolder.

Scope:
- Work only inside: C:\Users\PC\OneDrive\Desktop\kuberan web
- Do not touch files outside this folder
- Do not modify production Shopify code unless explicitly approved
- Do not push to GitHub unless explicitly told "push"
- Do not create duplicate files
- Do not invent business rules
- Do not delete or move existing assets

Pre-task checklist:
1. Inspect the folder structure
2. Find existing folders for: logs, daily logs, eod logs, evidence, closure,
   handover, validation, reports, prompts
3. Reuse existing folders first
4. Create new folders only if no suitable folder exists

During the task:
1. Save the task prompt used
2. Save important findings
3. Save evidence for every completion claim
4. Save validation notes if any check is performed
5. Save a running task log
6. Keep all files dated with YYYY-MM-DD
7. Make every saved file understandable tomorrow without verbal explanation

## Folder Map Discovered (2026-06-29)

| Purpose         | Existing Folder     | Action Taken     |
|-----------------|---------------------|------------------|
| Daily logs      | docs/               | REUSED           |
| EOD logs        | EOD/                | REUSED           |
| Evidence        | evidence/           | REUSED           |
| Closure         | closure/            | REUSED           |
| Validation      | validation/         | REUSED           |
| Prompts         | prompts/            | REUSED           |
| Handover        | handover/           | REUSED           |
| Duplicate-risk  | duplicate-risk/     | REUSED           |
| Reports         | docs/               | REUSED (no separate reports/ folder) |
| Logs            | docs/               | REUSED (no separate logs/ folder)    |

New folders created: NONE
