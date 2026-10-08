# Capabilities — 2026-10-05

## Capability — Post-Restructuring Leftover-Import Sweep (a critical refactor-safety lesson)

**Date:** 2026-10-05 (incident 2 of 2; incident 1 was 2026-10-02, same root cause class)
**Owner:** Kuberan
**Project:** dm-dashboard
**Status:** Both incidents resolved; a reusable check established

### Capability (a documented lesson, not a feature)

**A clean `py_compile` / `import app.main` pass is necessary but NOT sufficient evidence that a
file-move refactor didn't break anything.** Local (function-scoped) imports are invisible to both
checks — they only fail when the function containing them actually *runs*, which a plain import
never triggers (e.g. a function only called from a `@app.on_event("startup")` handler).

### What happened (2 real production incidents, same root cause)

After reorganizing ~250 flat backend files into `core/`, `staff_pages/`, `admin/`, `sales/`,
`ai_chat/`, `dev_tasks/`, several local imports were never updated to the new relative paths:

- **Incident 1 (2026-10-02)**: a missing import of `start_conduit_sold_snapshots()` (dropped by an
  unrelated bad merge) caused a crash-restart loop in production, invisible to any import-time
  check since it's only called from a startup handler.
- **Incident 2 (2026-10-05)**: `sales.py`'s `sync_status()` had `from .scheduled_snapshot import
  REGISTRY`, resolving to the wrong post-restructuring path — causing a 100%, scope-independent 500
  on one endpoint while its sibling endpoint worked fine (a diagnostic clue: a failure affecting
  *every* value of a parameter points at shared code, not scope-specific logic). **Swept for the
  same leftover-path pattern and found 3 more live-broken instances** in `ai_chat/ai_shared.py`,
  `ai_chat/kamsi_ai.py`, `ai_chat/sajeepan_ai.py`, `staff_pages/jefri_ai_assistant.py` — all fixed
  in one pass, confirmed via a final repo-wide grep returning zero remaining instances.

### The reusable check this establishes

After any future file-move/restructuring refactor in this codebase: **grep the whole tree for every
`from \.` relative import and verify each one resolves against the new file locations** — a cheap,
mechanical sweep that would have caught both incidents before they reached production. This is now
the standard step, not an afterthought.

### Originating task

`closure/dm-dashboard/2026-10-05_production-incidents-broken-imports_closure.md`

---

## Capability — Multi-Method Completeness Verification (export/audit discipline)

**Date:** 2026-10-05
**Owner:** Kuberan
**Status:** Done — SKU/price export delivered, completeness independently confirmed 3 ways

### Capability

When asked to export "every X, don't miss any," verify completeness through **multiple
independent methods that don't share a failure mode**, not a single count check:

1. A separate, unrelated API call for the total count (here: Shopify's own live `productsCount`
   field — no relation to the export's own pagination logic).
2. A cross-check against a second, independent data source (the business DB's nightly sync) —
   with any discrepancy explained by a real, named cause (sync lag), not hand-waved.
3. A breakdown by status/category to confirm every category is actually represented in the
   output — this is how a 4th Shopify product status (**Unlisted** — published to no sales
   channel, not deleted) was discovered mid-verification, not assumed from the commonly-known 3
   statuses (Active/Draft/Archived).

### Reusable principle

**When challenged twice on whether a number is really complete, respond with a new independent
check each time, not just reassurance.** This is exactly what happened here and is what surfaced
the Unlisted-status gap.

### Originating task

`closure/exports/2026-10-05_ledsone-uk-sku-price-export_closure.md`

### Limitations

Flagged, not hidden: 67 variants have a genuinely blank SKU in Shopify's own data — not something
the export missed or should fabricate a value for.
