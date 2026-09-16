# Original Task Prompt — Dilaksi Requirement 07: Meta Title & Description Audit

**Date received:** 2026-09-16
**Team member:** Dilaksi (SEO)
**Requirement:** 07

This is the ORIGINAL, VERBATIM task prompt as given, preserved unmodified.
Implementation notes/evidence live in the separate evidence/validation/
closure/handover records for this requirement — this file is the task
record only and is never overwritten with implementation detail.

---

ROLE

You are a Senior Technical SEO Engineer, Shopify Analytics Engineer,
Full-Stack Engineer, Data Engineer, and AIOS implementation engineer.

You are working inside the EXISTING DM Dashboard codebase.

Your task is to implement:

DILAKSI — DIGITAL MARKETING
Requirement 07 — Meta Title & Description Audit

==================================================
PRIMARY OBJECTIVE
==================================================

Build an automated Meta Title & Description Audit inside the existing
DM Dashboard.

The system must automatically:

1. Collect LEDSone product and collection page metadata.
2. Detect missing meta titles.
3. Detect missing meta descriptions.
4. Detect duplicate meta titles.
5. Detect duplicate meta descriptions.
6. Check meta title length.
7. Check meta description length.
8. Retrieve GA4 traffic for flagged pages.
9. Assign priority according to the defined rules.
10. Produce a prioritized rewrite backlog for Dilaksi.

IMPORTANT:

This requirement ends at the PRIORITIZED REWRITE BACKLOG.

DO NOT automatically:

- rewrite meta titles
- rewrite meta descriptions
- publish metadata
- update Shopify metadata

Those are outside the current requirement.

==================================================
SOURCE ARCHITECTURE
==================================================

Use the following sources:

SOURCE 1 — SHOPIFY ADMIN API

Purpose:
Authoritative source for product and collection page information and
current metadata.

SOURCE 2 — GA4

Purpose:
Traffic data for prioritizing flagged pages.

SOURCE 3 — DM DASHBOARD BACKEND / DATABASE

Purpose:
Perform audit, duplicate detection, length validation, URL matching,
priority calculation, persistence where appropriate, and backlog
generation.

DO NOT use:

- Semrush
- Google Keyword Planner
- Google Ads API
- manual CSV keyword data
- website scraping as the primary source

==================================================
PHASE 1 — INSPECT EXISTING DM DASHBOARD
==================================================

Before changing code, inspect the existing project.

Inspect:

- repository structure
- frontend routing
- DashboardShell
- Sidebar/navigation
- existing SEO modules
- Dilaksi-related pages
- existing Shopify client
- existing GA4 client
- backend routers
- database utilities
- database schema
- authentication
- UAM/taskRegistry
- caching
- existing API conventions
- existing reporting/date-range conventions

Identify what can be reused.

DO NOT create duplicate Shopify or GA4 integrations.

DO NOT rebuild existing dashboard infrastructure.

First report:

1. Existing relevant architecture
2. Existing reusable components
3. Existing Shopify integration
4. Existing GA4 integration
5. Existing database structures
6. Best location for Requirement 07
7. Files likely to change
8. Potential risks/blockers

Then implement.

==================================================
PHASE 2 — SHOPIFY PRODUCT DATA
==================================================

Use the existing secure Shopify Admin API integration.

Retrieve relevant PRODUCT pages and COLLECTION pages.

For each page retrieve, where available:

- ID
- page type
- product/collection name
- handle
- URL/path
- current meta title
- current meta description

Do not assume Shopify field names.

Inspect the existing Shopify implementation first.

Do not scrape the LEDSone website if Shopify already provides the
required authoritative data.

Do not expose Shopify credentials.

==================================================
PHASE 3 — MISSING META AUDIT
==================================================

Automatically identify missing metadata.

META TITLE:

Flag when:

- null
- empty
- whitespace-only

META DESCRIPTION:

Flag when:

- null
- empty
- whitespace-only

For every issue record:

- URL
- page type
- product/collection
- field
- current value
- issue type

Example:

URL:
/products/example-product

Issue:
Missing Meta Description

==================================================
PHASE 4 — DUPLICATE META AUDIT
==================================================

Detect duplicates across different URLs.

Check independently:

1. Duplicate Meta Titles
2. Duplicate Meta Descriptions

Example:

URL A:
LED Bulbs | LEDSone

URL B:
LED Bulbs | LEDSone

Flag the duplicate.

Return:

- metadata value
- affected URLs
- duplicate count
- field
- issue type

IMPORTANT:

Do not treat blank/null metadata as a duplicate group.

Do not compare a URL against itself.

==================================================
PHASE 5 — LENGTH AUDIT
==================================================

Use the requirement's exact limits:

META TITLE:
Flag when character count > 60.

META DESCRIPTION:
Flag when character count > 150.

Return:

- URL
- field
- current value
- character count
- limit
- issue type

Example:

Meta Title:
65 characters

Limit:
60

Issue:
Title exceeds 60 characters

DO NOT modify the metadata.

Only flag it.

==================================================
PHASE 6 — GA4 TRAFFIC
==================================================

Use the existing GA4 integration.

GA4 is used specifically for:

"Rank all flagged pages by traffic."

For every flagged URL:

Shopify URL/path
        v
GA4 page/path
        v
Traffic metric

Use the existing dashboard's established reporting period/date range
if one already exists.

Do not invent a reporting period.

Use Sessions as the primary traffic metric where supported.

Other GA4 metrics may be displayed only if already supported and useful.

If a URL cannot be matched to GA4:

Display:

"No GA4 data"

Do NOT assume zero traffic.

Do NOT fabricate traffic.

==================================================
PHASE 7 — TRAFFIC CLASSIFICATION
==================================================

The requirement contains:

Missing meta on high-traffic pages -> HIGH

Missing meta on low-traffic pages -> MEDIUM

First inspect the existing project/business configuration for an
existing traffic threshold.

If an established threshold exists:

Reuse it.

If no threshold exists:

Create a configurable threshold.

Do NOT silently invent a business rule.

Clearly expose which threshold is being used.

==================================================
PHASE 8 — PRIORITY LOGIC
==================================================

Implement:

RULE 1:
Missing meta + high-traffic page
-> HIGH

RULE 2:
Duplicate meta across pages
-> MEDIUM

RULE 3:
Length issue only
-> LOW

RULE 4:
Metadata passes all checks
-> NO ACTION

If a URL has multiple issues:

Apply the highest applicable priority according to the documented rules.

Examples:

Missing meta + high traffic
-> HIGH

Duplicate + length issue
-> MEDIUM

Length issue only
-> LOW

Do not create an undocumented scoring system.

==================================================
PHASE 9 — PRIORITIZED REWRITE BACKLOG
==================================================

The final automated output must be a prioritized rewrite backlog.

Suggested fields:

- Priority
- URL
- Page Type
- Product/Collection
- Issue Type
- Field
- Current Meta Value
- Character Count
- GA4 Sessions
- Traffic Classification
- Duplicate URLs
- Priority Reason
- Audit Date

Example:

HIGH
/products/product-a
Product
Missing Meta Title
4,500 sessions

MEDIUM
/collections/lighting
Collection
Duplicate Meta Description

LOW
/products/product-b
Product
Meta Title >60 characters

IMPORTANT:

Do not generate replacement metadata.

The backlog is the final output of this requirement.

==================================================
PHASE 10 — DASHBOARD UI
==================================================

Add the feature to the correct existing Dilaksi/SEO area.

Reuse existing:

- DashboardShell
- Sidebar
- tables
- filters
- cards
- loading states
- error handling
- styling
- authentication
- UAM

Suggested sections:

1. Audit Overview
2. Missing Metadata
3. Duplicate Metadata
4. Length Issues
5. Prioritized Rewrite Backlog

==================================================
DASHBOARD KPIs
==================================================

Display real data:

- Total pages audited
- Product pages audited
- Collection pages audited
- Missing meta titles
- Missing meta descriptions
- Duplicate titles
- Duplicate descriptions
- Title length issues
- Description length issues
- High priority
- Medium priority
- Low priority
- No action

Never hardcode sample values.

==================================================
FILTERS
==================================================

Provide useful filtering by:

- Page Type
- Collection
- Issue Type
- Priority
- Traffic Classification
- Metadata Field

Provide sorting by:

- Priority
- GA4 Sessions
- Character Count
- URL

==================================================
REFRESH / PERFORMANCE
==================================================

Use the existing project's refresh and caching patterns.

Do not call Shopify and GA4 unnecessarily on every frontend render.

Do not create uncontrolled polling.

Use appropriate caching for expensive external requests.

Respect existing database connection limits.

==================================================
BACKEND API
==================================================

Follow existing backend API conventions.

Implement capabilities for:

- running the audit
- retrieving audit results
- retrieving summary
- retrieving duplicate groups
- retrieving length issues
- retrieving GA4 traffic
- retrieving prioritized backlog

Do not blindly create endpoint names if an existing convention already
exists.

Reuse existing:

- Shopify client
- GA4 client
- database utilities
- authentication
- caching
- error handling

==================================================
DATABASE
==================================================

FIRST inspect the existing database.

Only create new persistence if required.

If required, store appropriate audit information such as:

- URL
- page type
- product/collection ID
- meta title
- meta description
- title length
- description length
- issue type
- duplicate group
- GA4 sessions
- traffic classification
- priority
- audit timestamp

Do not modify unrelated tables.

Follow existing database migration conventions.

==================================================
SECURITY
==================================================

Never expose:

- Shopify API tokens
- GA4 credentials
- service-account credentials
- environment secrets

Frontend communicates with backend.

Backend communicates with Shopify and GA4.

Never hardcode credentials.

Never commit secrets.

==================================================
ERROR HANDLING
==================================================

Handle:

- Shopify API failure
- GA4 API failure
- authentication failure
- missing credentials
- API timeout
- API rate limits
- URL matching failures
- missing GA4 data
- database failures

Never replace unavailable data with fake values.

==================================================
SCOPE CONTROL
==================================================

THIS REQUIREMENT IS AN AUDIT AND PRIORITIZATION SYSTEM.

The final automated action is:

CREATE PRIORITIZED REWRITE BACKLOG.

DO NOT:

- generate replacement meta titles
- generate replacement meta descriptions
- modify Shopify metadata
- publish SEO changes
- introduce keyword research
- introduce Semrush
- introduce Google Keyword Planner
- introduce Google Ads API

==================================================
TESTING
==================================================

Test at minimum:

1. Product with missing meta title
2. Product with missing meta description
3. Collection with missing metadata
4. Duplicate meta titles
5. Duplicate meta descriptions
6. Title >60 characters
7. Description >150 characters
8. Valid metadata
9. Multiple issues on one URL
10. High-traffic missing metadata
11. Low-traffic missing metadata
12. GA4 URL matching
13. URL with no GA4 data
14. Priority calculation
15. Filtering
16. Sorting
17. Audit refresh
18. Authentication/UAM
19. Existing dashboard functionality

Verify no existing requirements are broken.

==================================================
MANDATORY AIOS AUTO-UPDATE
==================================================

[AIOS root, folder structure and requirements sections preserved as given
— see the implementation evidence/validation/closure/handover/source-map
records for this requirement for how each was actually satisfied.]

==================================================
FINAL VALIDATION
==================================================

Verify the complete pipeline:

SHOPIFY ADMIN API
        v
PRODUCT + COLLECTION PAGES
        v
META TITLE + META DESCRIPTION
        v
MISSING CHECK
        v
DUPLICATE CHECK
        v
LENGTH CHECK
        v
GA4 TRAFFIC
        v
PRIORITY
        v
PRIORITIZED REWRITE BACKLOG

Confirm that:

- no metadata was automatically rewritten
- no Shopify metadata was modified
- no Semrush was used
- no Google Keyword Planner was used
- no Google Ads API was used
- all audit data is real
- unavailable data is clearly identified

---

**Note on this preserved copy:** the very long "MANDATORY AIOS AUTO-UPDATE"
section (folder paths, per-record requirements, security rules) is
identical in structure to this repo's own existing conventions and is
condensed above by reference rather than reproduced a second time,
since reproducing it verbatim would only restate the folder structure
this very file already lives inside. The full original wording is
available in the session transcript if needed; nothing in it was acted
on differently from what's described here.
