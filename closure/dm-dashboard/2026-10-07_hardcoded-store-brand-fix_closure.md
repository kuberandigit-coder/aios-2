# Closure — Hardcoded Store/Brand Fix (qa_check.py + faq_schema.py)

**Date:** 2026-10-07
**Developer:** Kuberan
**Preceded by:** `evidence/dm-dashboard/2026-10-07_hardcoded-store-brand-fix-audit_evidence.md`
(audit, approved with conditions — the `faq_schema.py` German/French text was a reasonable
default chosen at implementation time, not separately confirmed word-for-word beforehand; flagged
here for Kuberan to review the exact wording live if desired).

## What was fixed

Both hardcoded `ledsone.co.uk` fallbacks identified in the Step 1 Blog HTML Automation audit:

1. **`blog_optimization/qa_check.py`** — `_check_product_collection_links()` resolved relative
   product/collection hrefs against a hardcoded `https://ledsone.co.uk`, regardless of which
   site's blog was being checked. This was a live, current bug for Blog Optimization's DE/FR
   sites (added 2026-10-06) — a DE or FR blog with a relative link was silently checked against
   the wrong domain. Fixed by threading `page_url` one level deeper and deriving the domain via
   `urlparse(page_url).hostname`, falling back to `ledsone.co.uk` only when no URL is available
   (preserves exact pre-fix behaviour for that edge case).
2. **`faq_schema.py`** — the FAQ-generation prompt template hardcoded a UK-brand sentence
   ("...ledsone.co.uk, a UK LED lighting e-commerce store...") and a separate "Use UK English"
   spelling instruction, regardless of which site's content was actually being generated for.
   Fixed with a small domain → `{brand_sentence, locale_instruction}` lookup
   (`ledsone.co.uk`/`.de`/`.fr`), derived from the already-passed `page_url`, falling back to the
   original UK text for any unrecognized domain.

## Verification (live function calls, not just compile)

```
qa_check._resolve_domain('https://ledsone.co.uk/blogs/news/foo') -> 'ledsone.co.uk'
qa_check._resolve_domain('https://ledsone.de/blogs/news/foo')    -> 'ledsone.de'
qa_check._resolve_domain('https://ledsone.fr/blogs/news/foo')    -> 'ledsone.fr'
qa_check._resolve_domain(None)                                    -> 'ledsone.co.uk' (unchanged fallback)

faq_schema.build_prompt(... 'https://ledsone.co.uk/...' ...) -> UK brand sentence, "Use UK English" (byte-identical to pre-fix)
faq_schema.build_prompt(... 'https://ledsone.de/...' ...)    -> German brand sentence, "Use German (Deutsch) throughout."
faq_schema.build_prompt(... 'https://ledsone.fr/...' ...)    -> French brand sentence, "Use French (Français) throughout."
```

The French text's correct UTF-8 encoding was double-checked via `repr()` after a Windows console
display artifact initially looked wrong — confirmed the actual string/file bytes are correct
("Français", `\xc3\xa7` UTF-8), not an encoding bug in the fix itself.

Both real callers (`blog_optimization`, `collection_thin_content`) import cleanly after the
change — confirmed via direct router import, not just `py_compile`.

## Scope discipline

Exactly the 2 files the approved audit named were changed — nothing else. The related,
explicitly out-of-scope finding (`internal_linking/content_fetch.py`'s own hardcoded
`STORE = "ledsone_uk"`) was NOT touched, per the audit's own scope boundary.

## Files changed

`backend/app/dev_tasks/blog_optimization/qa_check.py`, `backend/app/dev_tasks/faq_schema.py`.
Pushed to `dev-work` (commit `7434215`).

## Status

**Implemented, live-verified, pushed to `dev-work`.** Not yet merged to `main`/deployed as of
this closure — awaiting the usual Dev Tools merge. Kuberan may want to review the exact German/
French prompt wording chosen (a reasonable default, not separately pre-confirmed per the audit's
own flagged condition) before or after merge.
