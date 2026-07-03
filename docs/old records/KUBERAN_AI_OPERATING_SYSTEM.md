# KUBERAN AI OPERATING SYSTEM

**Official Workflow Specification — Single Source of Truth**

| | |
|---|---|
| **Document type** | Standard Operating Procedure (SOP) |
| **Owner** | Kuberan |
| **Status** | Active |
| **Scope** | How ChatGPT, Claude Code, memory, repositories, documentation, and implementation workflows operate together |
| **Audience** | Any developer or AI operator continuing this work without prior context |

> This document is authoritative. If any tool, prompt, or person behaves differently from what is written here, this document wins. Update this document first, then change behaviour.

---

## 1. Purpose

This specification defines the **AI-assisted development system** used to plan, implement, validate, and document work across multiple e-commerce and SEO workstreams.

The system is built on a strict separation of responsibility between two AI layers:

- **ChatGPT decides.** It plans, designs, and reviews. It does **not** write production code.
- **Claude Code executes.** It reads files, implements approved changes, validates them, and produces evidence and documentation. It does **not** make business decisions.

A human (Kuberan) sits at the top of the chain and authorises every consequential action — especially anything that pushes code to a remote.

---

## 2. System Layers

### Layer 1 — ChatGPT (The Decider)

ChatGPT is responsible for thinking, not typing code. Its remit:

- Planning
- Strategy
- Architecture
- CRO (Conversion Rate Optimisation) decisions
- UX decisions
- Technical SEO planning
- Validation requirements
- Claude Code prompt generation
- Review and auditing

**ChatGPT does NOT directly implement code.** It produces the *instructions* that Claude Code will execute.

### Layer 2 — Claude Code (The Executor)

Claude Code is responsible for doing the work inside the codebase. Its remit:

- Reading project files
- Implementing approved changes
- Making code modifications
- Running validations
- Producing implementation evidence
- Creating task documentation

**Claude Code executes. ChatGPT decides.** Claude Code must never substitute its own judgement for a business or strategic decision that belongs to ChatGPT or to Kuberan.

---

## 3. Workstream Separation

Work is divided into **independent workstreams**. Each workstream has its **own dedicated ChatGPT conversation and context**. Workstreams must **never be mixed** — context, decisions, and prompts from one workstream must not leak into another.

### 3.1 Piranav Workstreams

**UI / UX:**
- ledsone.co.uk
- ledsone.fr
- electricalsone.co.uk

**Technical SEO:**
- Separate Piranav SEO workstream

### 3.2 Kuberan Workstreams

**UI / UX:**
- ledsone.de
- ledsone.us
- vintagelite.co.uk
- dcvoltage.co.uk

**Technical SEO:**
- Separate Kuberan SEO workstream

### 3.3 Rules of Separation

1. Each workstream = one dedicated ChatGPT conversation with its own context.
2. Do not carry decisions, prompts, or assets from one workstream into another.
3. UI/UX and Technical SEO are **separate** workstreams even for the same site.
4. When in doubt about which workstream a task belongs to, stop and confirm before proceeding.

---

## 4. Operating Model

The end-to-end flow for every piece of work:

```
User
  ↓
ChatGPT        (decide: objective, architecture, prompt, validation)
  ↓
Claude Code    (execute: inspect, implement, validate)
  ↓
Evidence       (files changed, validation results, before/after)
  ↓
Documentation  (per-task .md + daily log)
  ↓
Review         (ChatGPT audits the outcome)
  ↓
Next Action    (close task or iterate)
```

### Stage-by-stage

| Stage | Owner | What happens |
|---|---|---|
| **User** | Kuberan | Identifies an issue, goal, or opportunity and states it. |
| **ChatGPT** | ChatGPT | Analyses the request, defines the objective and outcome, designs the approach, and writes a precise Claude Code prompt plus a validation checklist. |
| **Claude Code** | Claude Code | Reads the codebase, finds root cause, proposes a fix, implements after approval, and validates. |
| **Evidence** | Claude Code | Captures files changed, validation output, screenshots, and before/after comparison. |
| **Documentation** | Claude Code | Writes one named `.md` per task and updates the daily log. |
| **Review** | ChatGPT | Audits the evidence and documentation against the success criteria. |
| **Next Action** | ChatGPT / Kuberan | Marks the task complete or defines the next iteration. |

---

## 5. ChatGPT Responsibilities (Detailed)

For every task, ChatGPT must:

1. Define the **objective**.
2. Define the **business outcome**.
3. Define the **revenue impact**.
4. Review the **existing assets** (current code, content, design, data).
5. Define the **architecture** / approach.
6. Identify **risks**.
7. Create the **Claude Code prompt**.
8. Define the **validation checklist**.
9. Define the **review requirements**.
10. Define the **success metrics**.
11. Define the **next action**.

ChatGPT hands Claude Code a self-contained brief. Claude Code should never have to guess strategy.

---

## 6. Claude Code Responsibilities (Detailed)

For every task, Claude Code must:

1. **Inspect** the existing implementation.
2. Identify the **root cause** (never patch a symptom blindly).
3. **Propose** a solution.
4. **Wait for approval** when the change is consequential or explicitly gated.
5. **Implement** the solution.
6. **Validate** the implementation.
7. **Generate evidence**.
8. **Generate documentation**.

**Claude Code must not make business decisions.** Strategy, revenue trade-offs, and scope belong to ChatGPT and Kuberan.

---

## 7. Claude Memory Rules

These are permanent operational rules. They are stored in the memory source of truth (see §11) and must be honoured every session.

### 7.1 No Git Push Without Permission

Never push to any remote repository unless **explicitly instructed in that moment**. A task that *implies* pushing does not authorise a push. Always stop and confirm first.

### 7.2 Markdown Storage Rules

All markdown files must be stored in a **dated subfolder**:

```
C:\Users\PC\OneDrive\Desktop\website technical - Kuberan\YYYY-MM-DD\
```

- Create the dated folder automatically if it does not exist.
- **Every** `.md` goes there — audits, reports, logs, checklists, guides, task docs, daily log.
- **Never** save markdown files loose in the root directory.

### 7.3 Daily Log Rules

- Maintain a `YYYY-MM-DD.md` daily log in the dated folder.
- **No duplicate tasks.** Each completed task appears **once only** — no reworded repeats, no copy-pasted entries.

### 7.4 Per-Task Documentation

Every completed task must generate **its own markdown file**, named descriptively after the task.

Example: `BULLET_INTRO_TYPOGRAPHY_FIX.md`

A day with many tasks therefore produces **one `.md` per task** plus the daily log that summarises and **links** each per-task file.

Each per-task file must include:

- Objective
- Root Cause
- Files Changed
- Changes Made
- Validation
- Outcome

---

## 8. Repository Structure

### 8.1 blog-builder

| | |
|---|---|
| **Purpose** | Blog writing tool source code |
| **Primary file** | `index.html` |
| **Remote** | `origin` |
| **Branch** | `master` |
| **GitHub** | https://github.com/kuberandigit-coder/blog-builder |
| **Push command** | `push blog tool` |

On `push blog tool`: commit **only** `index.html`, leave any other working-tree changes untouched, push to `origin/master`. Only on the explicit command.

### 8.2 aios-kuberan

| | |
|---|---|
| **Purpose** | Daily logs, task documentation, requirements archive |
| **Remote** | `aios` |
| **Branch** | `main` |
| **Path** | `requirements/YYYY-MM-DD/` |
| **GitHub** | https://github.com/kuberandigit-coder/aios-kuberan |
| **Push command** | `done for today` |

On `done for today`: push the **entire dated folder** to aios-kuberan **only**, never to blog-builder.

### 8.3 loyalty-dashboard-de (reference)

Shopify loyalty app. Production deploy on **Render + Neon**. Not part of the two push commands above; same no-push-without-permission rule applies.

---

## 9. Standard Task Workflow

The exact sequence for every task:

1. **User** identifies an issue.
2. **User** explains the issue to ChatGPT.
3. **ChatGPT** analyses the issue.
4. **ChatGPT** creates the Claude Code prompt.
5. **Claude Code** inspects the codebase.
6. **Claude Code** identifies the root cause.
7. **Claude Code** proposes a fix.
8. **Claude Code** implements the fix.
9. **Claude Code** validates the fix.
10. **Claude Code** creates documentation.
11. **ChatGPT** reviews the outcome.
12. **Task completed.**

---

## 10. Command Reference

| Command | Trigger phrases | Action |
|---|---|---|
| **push blog tool** | "push blog tool" | Commit & push only `index.html` → blog-builder (`origin/master`). |
| **done for today** | "done for today", "push everything done today", "wrap up", "end of day" | Save per-task `.md` files + daily log → push the dated folder → aios-kuberan (`aios/main`, `requirements/YYYY-MM-DD/`). |

### `done for today` — push method (divergent history)

```
git stash push -u                          # if working tree has pending changes
git fetch aios main
git checkout -b temp-YYYYMMDD aios/main
# copy the dated folder into requirements/YYYY-MM-DD/
git add requirements/YYYY-MM-DD/
git commit -m "docs: daily log + task files for YYYY-MM-DD"
git push aios temp-YYYYMMDD:main
git checkout master
git branch -D temp-YYYYMMDD
git stash pop                              # restore prior working tree
```

---

## 11. Memory — Source of Truth

All working rules are read from and written to **one folder only**:

```
C:\Users\PC\OneDrive\Desktop\website technical - Kuberan\claude-memory\
```

- This folder is authoritative. No other memory store is used.
- Each rule is one file; `MEMORY.md` is the index.
- Update the source-of-truth folder first, then rely on the behaviour.

---

## 12. Documentation Standards

Every task document should contain the following sections:

1. **Objective** — what the task set out to achieve.
2. **Background** — context needed to understand the work.
3. **Root Cause** — the underlying reason for the issue (for fixes).
4. **Files Changed** — exact files and locations.
5. **Implementation Details** — what was changed and how.
6. **Validation Performed** — how correctness was confirmed.
7. **Outcome** — the result, stated plainly.
8. **Future Considerations** — follow-ups, risks, or related work.

---

## 13. Evidence Requirements

**Implementation is not complete without evidence.** Required evidence for every task:

- Files changed
- Validation results
- Screenshots (when applicable / when the change is visual)
- Root cause explanation
- Before / after comparison

Evidence is captured by Claude Code and reviewed by ChatGPT before a task is considered done.

---

## 14. Success Criteria

A task is **only complete** when **all** of the following are true:

- [ ] Objective achieved
- [ ] Validation completed
- [ ] Documentation created (per-task `.md` + daily log entry)
- [ ] Evidence supplied
- [ ] No regressions introduced
- [ ] A future developer can understand the work from the documentation alone

If any box is unchecked, the task is still open.

---

## 15. Quick-Reference Summary

| Question | Answer |
|---|---|
| Who decides? | **ChatGPT** |
| Who executes? | **Claude Code** |
| Who authorises pushes? | **Kuberan**, explicitly, every time |
| Where do `.md` files go? | `website technical - Kuberan\YYYY-MM-DD\` |
| Where do daily logs + task docs get pushed? | **aios-kuberan** (`done for today`) |
| Where does blog code get pushed? | **blog-builder** (`push blog tool`) |
| Where are the rules stored? | `website technical - Kuberan\claude-memory\` |
| When is a task done? | Only when §14 success criteria are all met |

---

*End of document — KUBERAN_AI_OPERATING_SYSTEM.md*
