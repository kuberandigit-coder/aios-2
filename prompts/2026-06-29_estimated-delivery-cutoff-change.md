---
title: 2026-06-29 Task Prompt — Estimated Delivery Cutoff Change
date: 2026-06-29
task_name: Delivery Timer Restart/Cutoff Change — 11:00 AM to 12:00 PM Germany Time
purpose: Saved prompt used to instruct the delivery timer cutoff change on ledsone-de.
evidence_path: evidence/2026-06-29_estimated-delivery-cutoff-change.md
status: COMPLETE
reviewer: Varmen / Kuberan
---

## Prompt Used (verbatim)

You are working inside:
C:\Users\PC\OneDrive\Desktop\kuberan web

Objective:
Find and analyze the Shopify theme code section/snippet related to "estimate delivery time", then prepare the safest change so the restart/reset/cutoff time uses 11:00 AM to 12:00 PM Germany time.

Context:
This is a Shopify theme code task for Kuberan's approved Mini-AIOS subfolder. GPT is the brain and Claude Code is the worker. Do not make broad theme changes.

Before doing anything:
Search existing assets first across the approved folder only:
- sections/
- snippets/
- assets/
- layout/
- templates/
- config/
- documentation/evidence folders if present

Search terms:
- estimate delivery
- delivery time
- estimated delivery
- delivery-date
- shipping estimate
- cutoff
- cut off
- restart
- reset
- countdown
- timer
- Germany
- Berlin
- timezone
- date
- Date()
- Intl.DateTimeFormat
- moment
- luxon

Scope:
You may:
1. Search and identify the exact file/files controlling estimate delivery time.
2. Read the logic and explain how the current restart/cutoff time works.
3. Change only the minimum required code so the restart window is 11:00 AM to 12:00 PM Germany time.
4. Use IANA timezone `Europe/Berlin` if JavaScript timezone handling is needed.
5. Create an evidence/validation markdown file documenting the change.

You must not:
- Touch unrelated theme files.
- Change product pricing, PPC, ads, checkout, tracking, schema, or unrelated business logic.
- Push to GitHub without permission.
- Create duplicate delivery-time sections/snippets if an existing one is found.
- Guess the logic if the source file is unclear.

Tasks:
1. Locate the delivery estimate code.
2. Output the exact file path and matching lines/functions.
3. Explain current restart/cutoff behavior.
4. Identify the smallest safe change needed for 11:00 AM–12:00 PM Germany time.
5. Apply the change only if the correct source file is clearly identified.
6. Save evidence markdown with:
   - objective
   - file touched
   - old logic summary
   - new logic summary
   - Germany timezone handling
   - validation steps
   - known limits
   - pass/fail result

Evidence required:
- Exact file path
- Before/after code summary
- Validation output
- Evidence markdown path

Output format:
| Check | Evidence | Status | Gap |
|---|---|---|---|

Also output:
- Files touched
- Evidence file created
- Duplicate risk
- Validation result
- Final decision: GREEN / AMBER / RED

Stop conditions:
Stop and report if:
- More than one delivery-time source exists
- The source of truth is unclear
- The change requires app/admin/production settings outside theme code
- The logic affects unrelated delivery/business rules
- Evidence cannot be saved

Pass/fail:
PASS if the exact existing delivery-time code is found, only the required restart-time logic is changed to 11:00 AM–12:00 PM Europe/Berlin time, and evidence is saved.
FAIL if the file is unclear, duplicate logic exists, or the change cannot be validated.

---

## Result Summary

| Item | Detail |
|------|--------|
| File found | `snippets/estimated-delivery.liquid` |
| Source unique | YES — no duplicate logic in any .js file |
| Changes applied | 6 change points across `isWeekendHidden()`, `getNextNoon()`, `updateTimers()` |
| Comments added | YES — every changed line marked with `CHANGED/ADDED Kuberan 29/06/2026` |
| Evidence saved | `evidence/2026-06-29_estimated-delivery-cutoff-change.md` |
| Validation saved | `validation/2026-06-29_estimated-delivery-cutoff-change.md` |
| Closure saved | `closure/2026-06-29_estimated-delivery-cutoff-change.md` |
| Pushed to live | NO — awaiting approval |
