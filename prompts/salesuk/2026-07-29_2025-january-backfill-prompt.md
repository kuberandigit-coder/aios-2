# Prompt — salesuk.html: 2025 January Backfill

**Title:** Extend UK order-level sales review backward into 2025
**Purpose:** Same order-level, zero-double-counting sales review already built for Jan–Jul 2026, now started for 2025 history.
**Requirement Source:** User request, 2026-07-29 — "now i have a new task we done for 2026 jan to june and july live like the same we need to gather data of 2025 january now do not miss any order if any new com show that new in the table, create only need tabs"

## Scope decisions (asked up front, per user's answers)
- **Scope:** Only January 2025 for now (not the full year) — confirmed via clarifying question.
- **Unassigned handling:** Apply the existing 2026-confirmed campaign/UTM ownership rules only; do not re-litigate ownership interactively for 2025. Anything unrecognized falls into Not Assigned for later review.
- **Mid-task correction:** User interrupted to require a **separate backend file** for 2025 data ("create a new js file for 2025 sales - named the file sales25.js") rather than extending `api/salesuk.js`'s `SUPPORTED_MONTHS` array — implemented as `api/sales25.js`, a self-contained clone of `salesuk.js`'s classification/grouping logic.
