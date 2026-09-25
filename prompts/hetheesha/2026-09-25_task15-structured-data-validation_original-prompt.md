# Task 15 — Structured Data Validation (ledsone.fr) — Original Prompt (verbatim)

**Date:** 2026-09-25  
**Owner:** Hetheesha  
**Project:** DM Dashboard

The text below is the prompt exactly as received (only the paste wrapper tags were removed).

---

Yes da. You don't want separate phase prompts. You want **one complete Claude Code prompt that develops the entire Task 15 page/workflow**, with the **AIOS AUTO-UPDATE mandatory**, while avoiding unnecessary long-running tests.

Use this:

```text
TASK 15 — HETHEESHA
STRUCTURED DATA VALIDATION — LEDSONE.FR

Read CLAUDE.md and inspect the existing DM Dashboard architecture before coding.

GOAL

Build a complete automated Structured Data Validation module for ledsone.fr under:

Development Tasks → Hetheesha → Task 15 — Structured Data Validation

The purpose is to automatically audit structured data, identify errors/conflicts, prioritize issues, provide evidence/fix guidance, and support re-validation after fixes.

CORE WORKFLOW

ledsone.fr
→ URL/template discovery
→ Schema extraction
→ Product validation
→ Organization validation
→ Breadcrumb validation
→ Duplicate/conflict detection
→ GSC data where actually available
→ Issue classification
→ Priority
→ Dashboard
→ Fix/re-validation status

SOURCE SYSTEMS

Reuse existing integrations where available:

- ledsone.fr live website
- Shopify Admin API — France store
- Google Search Console — ledsone.fr
- Shopify theme/code
- Shopify apps that generate schema
- Existing DM Dashboard backend/database
- Existing Google/GSC authentication
- Existing reusable dashboard/validation components

Do not create duplicate integrations if an existing one can be reused.

PAGE REQUIREMENTS

Create the Task 15 page using the existing DashboardShell, navigation, design system and reusable components.

Recommended tabs/sections:

1. Overview
2. Template Audit
3. Product Schema
4. Organization
5. Breadcrumbs
6. Duplicate / Conflicts
7. GSC Issues
8. Fix & Re-validation

OVERVIEW

Show:

- Total URLs checked
- Valid URLs
- Errors
- Warnings
- High priority
- Medium priority
- Low priority
- No action
- Product schema issues
- Duplicate/conflicting schema
- GSC issues
- Last validation time

Allow filtering by:

- URL
- Template
- Schema type
- Issue
- Priority
- Status

TEMPLATE AUDIT

Automatically identify/check representative or available:

- Homepage
- Collection pages
- Product pages
- Blog/article pages

Show:

URL | Template | Schema Types | Errors | Warnings | Priority | Status

PRODUCT VALIDATION

Validate Product structured data against actual available Shopify/page data.

Check where applicable:

- name
- image
- description
- sku
- gtin
- mpn
- brand
- offers
- price
- priceCurrency
- availability
- url
- shippingDetails
- hasMerchantReturnPolicy
- aggregateRating/review only when genuine supporting data exists

FRANCE-SPECIFIC VALIDATION

Detect mismatches such as:

Shopify/page:
EUR / €49.99

Schema:
GBP / £49.99

Also detect:

- schema price ≠ actual price
- schema currency ≠ expected currency
- schema availability ≠ actual availability
- schema URL mismatch
- missing important fields

Do not hardcode product values.

ORGANIZATION

Check relevant Organization structured data for:

- name
- logo
- url
- sameAs
- available contact information

BREADCRUMB

Check BreadcrumbList on applicable collection/product/content pages.

Validate:

- presence
- hierarchy
- names
- URLs
- consistency with the actual page structure

DUPLICATE / CONFLICT DETECTION

Detect when a page contains:

- multiple Product schemas
- duplicate JSON-LD
- theme + app schema duplication
- conflicting Product values
- conflicting price/currency/availability

Show the detected schemas and explain the conflict where possible.

GSC

Reuse the existing GSC integration.

Only use GSC data/endpoints that are actually available through the current integration/API.

Do not invent endpoints for Search Console UI enhancement reports.

Where available, show relevant:

- Product issues
- Merchant-related issues
- Breadcrumb issues
- affected URLs
- errors
- warnings

Keep GSC data clearly separated from page/schema validation data.

ISSUE PRIORITY

Use:

HIGH
- invalid/missing important Product schema
- wrong price/currency
- wrong availability
- duplicate/conflicting Product schema

MEDIUM
- important Merchant-related warnings
- missing supporting fields that affect eligibility

LOW
- optional/recommended fields

NO ACTION
- valid schema with no relevant issue

Store the reason for the priority.

FIX / RE-VALIDATION

Do not automatically modify Shopify theme, products or SEO data.

For each issue provide:

- URL
- issue
- detected value
- expected/reference value where available
- source
- priority
- recommended fix
- status

Statuses can include:

OPEN
FIX_REQUIRED
READY_FOR_RECHECK
PASSED
FAILED

Allow a re-validation action using the existing validation architecture.

After re-validation, preserve the previous result so the user can see:

Before → Fix → After

No automatic production changes.

CSV / REPORT OUTPUT

Provide a CSV export for the audit results.

Minimum columns:

URL
Template
Schema Type
Issue
Field
Current Value
Expected Value
Priority
Status
Source
Detected At
Last Validated

Do not fabricate values.

BACKEND

Implement the required backend endpoints using the existing FastAPI architecture.

Reuse:

- existing authentication
- existing database patterns
- existing Shopify client
- existing Google/GSC client
- existing caching patterns

Avoid unnecessary new infrastructure.

Use appropriate caching for expensive validation operations.

Do not expose API tokens or service-account credentials.

FRONTEND

Use existing dashboard UI patterns.

Provide:

- loading states
- empty states
- error states
- pagination where required
- filters
- sorting
- detail views
- validation status
- last-run timestamp
- manual validation/re-validation control

If polling is used, pause polling when the page is hidden using the existing dashboard pattern.

UAM

Register Task 15 through the existing centralized taskRegistry/UAM system.

Access must follow the existing:

Development Tasks → Hetheesha

permission structure.

Do not create a separate permission system.

DATA SAFETY

- No fabricated URLs.
- No fabricated schema values.
- No fabricated GSC data.
- No automatic Shopify production modifications.
- Never expose secrets.
- Never store credentials/private keys in source code.
- Use actual ledsone.fr data.

TESTING

Do NOT run a large exhaustive test suite.

Only perform lightweight checks needed to confirm:

- backend starts/imports correctly
- frontend builds/loads
- required routes/endpoints connect
- obvious runtime errors are absent

I will manually test the complete UI and workflow.

Do not spend excessive time generating automated test coverage.

DEPLOYMENT

Do not deploy to production unless explicitly requested.

AIOS AUTO-UPDATE — MANDATORY

AIOS ROOT:

C:\Users\PC\OneDrive\Desktop\kuberan web

Before creating AIOS documentation:

1. Search existing AIOS records/assets for Task 15, Structured Data, GSC, Shopify and related validation work.
2. Reuse existing documentation/assets instead of creating duplicates.
3. Preserve the original Task 15 requirement and implementation prompt.
4. Document the completed implementation.
5. Save relevant implementation evidence/references.
6. Create/update validation documentation with PASS / FAIL / PARTIAL.
7. Create/update handover documentation containing:
   - what was built
   - location/files
   - data sources
   - important logic
   - UAM
   - current status
   - known issues
   - manual checks remaining
8. Update source-map only when actual sources/connectors/APIs were added or changed.
9. Update capability documentation only if this creates a reusable capability; reuse existing capability records where applicable.
10. Do not store API keys, passwords, tokens, private keys or service-account JSON contents in AIOS.
11. Use existing AIOS naming conventions.
12. Do not create duplicate AIOS records.
13. Do not create closure until the implementation is genuinely complete.
14. Record the final AIOS status accurately.

FINAL RESPONSE

Return a concise implementation summary:

1. Task 15 status
2. Page/routes created
3. Backend/API changes
4. Validation capabilities
5. CSV/export capability
6. UAM result
7. AIOS updates
8. Issues/blockers
9. Manual checks remaining
```

### Final user outcome

After Claude completes this, Hetheesha should have **one Task 15 page** where she can run/check the France structured-data audit instead of manually checking pages one by one.

The important part is that **the automation is behind the page** — not just a UI that displays manually collected results.
