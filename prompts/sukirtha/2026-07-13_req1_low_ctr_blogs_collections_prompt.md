---
title: Sukirtha Req1 — Original Requirement Prompt
date: 2026-07-13
type: prompt
---

# Title
Sukirtha Requirement 1 — Low CTR Blog Posts and Collections Identification
(original requirement prompt)

# Purpose
Preserve the exact original requirement text as received, for future
reference and to prevent re-interpretation drift.

# Business Question
Which blog posts and collection pages on ledsone.de have a CTR below 1.5%
during the last 6 months and should be prioritised for SEO optimisation?

# Requirement Source
Received verbatim from the user, 2026-07-13.

# Original Requirement Text

> Requirement: Sukirtha Requirement 1 – Low CTR Blog Posts and Collections Identification
>
> Business Question: Which blog posts and collection pages on ledsone.de
> have a CTR below 1.5% during the last 6 months and should be
> prioritised for SEO optimisation?
>
> Before implementation: search the Sukirtha AIOS folder for existing
> Requirement 1 assets; do not create duplicate HTML pages; update
> Staff-requirements/pages/sukirtha.html.
>
> Inspect approved data sources (read-only): PostgreSQL `ledsone-db`,
> `ledsone-aios-knowledge-base`. Determine whether GSC page-level data
> already exists; if available, use the imported PostgreSQL GSC data,
> otherwise use the approved GSC connection.
>
> Retrieve ONLY: Blogs, Collections. Store: ledsone.de. Date Range: last
> 6 months. Columns: Page URL, Type (Blog/Collection), Impressions,
> Clicks, CTR %, Average Position, Status. Status rule: IF CTR < 1.5%
> Status = Low CTR else OK. Sort by CTR ascending.
>
> Create a professional dashboard inside sukirtha.html with: summary
> cards, filters, search, export CSV, responsive table, last refresh
> timestamp, evidence section.
>
> Automatically update AIOS: prompts/sukirtha/, evidence/sukirtha/,
> validation/sukirtha/, handover/sukirtha/, reports/sukirtha/,
> vercel/sukirtha/. Every generated asset must include the standard
> metadata template (Title, Purpose, Business Question, Requirement
> Source, PostgreSQL Sources Checked, Shopify Sources Checked, Files
> Modified, Evidence Location, Validation Result, Owner, Reviewer,
> Status, PASS/FAIL, Next Step).
>
> Return a discovery report before modifying any files: existing asset
> check, PostgreSQL schema/table mapping, GSC source mapping, duplicate
> risk assessment, PASS/FAIL readiness.

# PostgreSQL Sources Checked
N/A — this file is a verbatim record of the prompt, not an analysis.

# Shopify Sources Checked
N/A

# Files Modified
None.

# Evidence Location
`evidence/sukirtha/2026-07-13_req1_discovery_and_gsc_access_gap_evidence.md`

# Validation Result
See `validation/sukirtha/2026-07-13_req1_discovery_validation.md`.

# Owner
Kuberan (AIOS) / Claude Code session.

# Reviewer
Pending.

# Status
Prompt recorded. Requirement blocked pending GSC access grant (see
handover file).

# PASS / FAIL
N/A (record-keeping artifact).

# Next Step
See `handover/sukirtha/2026-07-13_req1_discovery_handover.md`.
