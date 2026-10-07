# Handover — Hardcoded Store/Brand Fix Audit

Date: 2026-10-07
Owner: Kuberan
Status: **Audit complete. Fix NOT implemented — waiting on explicit approval + one content
decision.**

## Task

Follow-up to the Blog HTML Automation Step 1 audit (2026-10-07), which flagged two hardcoded
`ledsone.co.uk`/UK-brand assumptions as risks. This task fully traced both, every caller, the
existing store-configuration options, and proposed a safe fix — without changing any code.

## Findings

- **`blog_optimization/qa_check.py`** (`_check_product_collection_links`): hardcodes
  `https://ledsone.co.uk` as the fallback domain for relative product/collection links. Only one
  real caller exists (`blog_optimization/router.py`), and it's a **live bug today** — Blog
  Optimization already supports `ledsone.de`/`ledsone.fr`, so a relative link on a DE/FR blog is
  currently checked against the wrong domain.
- **`faq_schema.py`** (`_PROMPT_TEMPLATE`): hardcodes a UK-brand sentence AND a separate "Use UK
  English" spelling instruction. Two real callers: `blog_optimization` (affected the same way as
  above — live bug for DE/FR) and `collection_thin_content` (unaffected either way, since that
  caller's own URLs are always UK, confirmed via its own hardcoded `STORE`/`SITE_BASE`).
- **Both fixes are clean**: the function in both cases already receives a full `page_url`
  argument containing the real domain — the fix derives domain/locale from that, no new
  parameter or caller change needed anywhere.
- **Related, out-of-scope finding**: `internal_linking/content_fetch.py` hardcodes
  `STORE = "ledsone_uk"` — the Internal Linking content index itself is UK-only regardless of
  this fix, which limits how useful the `faq_schema.py` fix can be for DE/FR internal-link
  suggestions specifically. Not part of this approval.

## Proposed changes (NOT implemented)

1. `qa_check.py`: thread `page_url` into `_check_product_collection_links`, derive the
   resolve-against domain via `urlparse`, keep `ledsone.co.uk` only as the no-URL fallback.
2. `faq_schema.py`: derive brand label + locale-spelling instruction from `page_url`'s domain via
   a small new lookup, same fallback pattern.

## Risk

**LOW** for both — zero caller-signature changes, confirmed zero impact on every other
Development Task (grep-verified, not assumed), UK behaviour provably unchanged by construction.

## Implementation conditions

- `qa_check.py` fix: ready to implement as-is once approved — no open questions.
- `faq_schema.py` fix: needs Kuberan to confirm the actual German and French brand-label and
  spelling-locale instruction text before implementation — the audit deliberately did not invent
  this wording.

## Next step

Kuberan reviews the full evidence doc
(`evidence/dm-dashboard/2026-10-07_hardcoded-store-brand-fix-audit_evidence.md`) and explicitly
approves before any code is touched, per the task's own instruction. **No closure document yet**
— the fix itself has not been implemented.
