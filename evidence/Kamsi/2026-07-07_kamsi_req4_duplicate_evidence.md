# Evidence — Kamsi Requirement 4: Duplicate of Dilaksi Requirement 2

**Title:** Kamsi Req 4 created as an exact duplicate of Dilaksi Req 2 (Product Priority Guidance)
**Purpose:** Prove the duplication was exact, label-only, and no data was touched
**Requirement Source:** GPT planning layer instruction, 2026-07-07
**Business Question:** Can Kamsi have a Requirement 4 page reusing Dilaksi Req 2's already-built, already-approved report, with zero new data-collection cost?
**PostgreSQL Sources Checked:** Not checked for this task because copy-only reuse was requested
**External Sources Checked:** Not checked for this task because copy-only reuse was requested

## Step 1 — Existing asset discovery (results)
- **Dilaksi Requirement 2 source found:** `reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html` (live, paginated client-side build, 5,179 products, all-collections scope) and its archival twin `reports/dilaksi/dilaksi-req2-all-collections-product-priority.html`.
- **Existing Kamsi assets found:** `kamsi.html` (stale member-index stub, lists only R1/R2 — pre-existing, not touched by this task), `kamsi-req1-slow-moving-products.html`, `kamsi-req2-low-ctr-pages.html`, `kamsi-req3-core-ga4-seo.html` (each with a live R1–R3 tab-nav). No `kamsi-req4-*` file existed anywhere in the repo before this task (confirmed via full-repo search).
- **Duplicate risk:** None found — Kamsi Requirement 4 did not previously exist.
- **Decision:** Reuse Dilaksi Req 2 code verbatim; create new Kamsi Req 4 page; do not touch Dilaksi's files; add Req 4 tab links to Kamsi's existing R1–R3 pages for consistent cross-navigation (label-only nav change, no data).

## Step 2 — Copy method
Used a Python script (`reports/Kamsi/data/2026-07-07_kamsi_req4_duplicate_from_dilaksi_req2.py`) that reads the Dilaksi Req 2 file byte-for-byte and performs **exactly 6 targeted string replacements**, asserting each old string exists before replacing (fails loudly if the source ever changes underneath it):

1. `<title>` — "Dilaksi Requirement 2" → "Kamsi Requirement 4"
2. Tab-nav block — Dilaksi's R1/R2/R3 nav → Kamsi's R1/R2/R3/R4 nav (R4 marked active)
3. Eyebrow label — "Requirement 2" → "Requirement 4 ... duplicated from Dilaksi Requirement 2"
4. "Requested by: **Dilaksi**" → "Requested by: **Kamsi**"
5. Rule-note attribution — added "(reused as-is for Kamsi Requirement 4, unchanged)" note
6. Footer — added a "Kamsi Requirement 4 note" line disclosing the duplication, before the existing (untouched) scope/data-source/performance paragraphs

**Everything else — CSS, JavaScript, the embedded product dataset (JSON array of all 5,179 rows), table structure, badges, SEO Priority rule text, summary cards, pagination logic — is byte-identical to the Dilaksi source.** Input file: 3,724,544 bytes. Output file: 3,725,083 bytes (+539 bytes = exactly the label text added, nothing else).

## Step 3 — No-data-change validation
- **No external connector called** during this task (no MCP Shopify/Semrush/GA4/GSC tool calls made).
- **No PostgreSQL query run.**
- **No Shopify query run.**
- **No GA4 query run.**
- **No GSC query run.**
- **Data rows:** confirmed 5,179 rows in the embedded `ROWS` JSON array of the new Kamsi file — identical count and content to the Dilaksi source (verified programmatically, see validation file).
- **Column names/fields:** unchanged (`t,st,c,sk,nv,s,u,d,k,o,p,cond` — same keys as Dilaksi's dataset).
- **Calculations:** unchanged (same SEO Priority rule text and logic, same JS filter/pagination code).
- **UI:** unchanged (same CSS, same layout, same summary cards, same toolbar/filters).

## Files created
- `reports/digital-marketing-member-pages/pages/kamsi-req4-product-priority-guidance.html` (live-site copy, tab-nav updated)
- `reports/Kamsi/kamsi-requirement-4-product-priority-guidance.html` (archival copy, matches existing `reports/Kamsi/kamsi-requirement-{1,2,3}-*.html` naming convention)
- `reports/Kamsi/data/2026-07-07_kamsi_req4_duplicate_from_dilaksi_req2.py` (the exact, auditable duplication script)
- Tab-nav on `kamsi-req1-slow-moving-products.html`, `kamsi-req2-low-ctr-pages.html`, `kamsi-req3-core-ga4-seo.html` updated to add a Requirement 4 link (label-only change, their own report content/data untouched)

**Dilaksi files touched:** none. Confirmed via `git status` before/after — only the listed Kamsi files and this AIOS doc set changed.

## Known limitations
- The task's Step 2 instructions suggested the tab label "Kamsi Requirement 4 — Core GA4 Data for SEO" — that exact phrase is already Kamsi's Requirement 3 title. Using it for Req 4 as well would be a duplicate/confusing label. I used **"Kamsi Requirement 4 — Product Priority Guidance"** instead, matching what Dilaksi Req 2 actually is, and flagged this substitution here rather than silently applying a conflicting label. Flag to Kuberan if a different label is preferred.
- The underlying dataset is literally Dilaksi's ledsone.co.uk full-catalog product data (5,179 products, all collections) — as instructed, it was copied exactly with no attempt to substitute Kamsi-specific data, since the task explicitly required a pure duplicate, not a re-run against different inputs.
- `kamsi.html` (the stale member-index stub that only lists R1/R2, missing R3 already) was **not** updated — out of scope for this task and pre-existing before this session.

**Evidence path:** this file · **Validation:** `validation/Kamsi/2026-07-07_kamsi_req4_duplicate_validation.md`
**Owner:** Kamsi · **Reviewer:** Kuberan
**Status:** Completed locally — **not deployed** (deployment requires explicit approval, not requested)
**Next step:** Kuberan review of the label decision above; deployment approval if desired
**PASS / FAIL:** PASS
