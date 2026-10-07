# Hardcoded Store/Brand Fix — Audit & Change Impact

Date: 2026-10-07
Repo: dm-dashboard, branch `dev-work` (confirmed, not touched)
Developer: Kuberan
**AUDIT ONLY — no code, database, or frontend changes made. No deploy, merge, or push.**

## 1. Executive Summary

Both hardcodes found in the Step 1 Blog HTML Automation audit (2026-10-07) are real, and both
have a clean, low-risk, zero-caller-impact fix available: **in both cases, the function
receiving the hardcode is already passed a full `page_url` argument that contains the real
domain** (`https://ledsone.de/blogs/...`, etc.) — the fix is to derive the domain/brand context
from that already-available argument instead of hardcoding it, not to add a new parameter or
change any function signature. Both current callers (`blog_optimization` and, for
`faq_schema.py` only, `collection_thin_content`) already pass a real, correctly-scoped
`page_url` today.

A **third, related hardcode** was found one layer upstream of `faq_schema.py`'s internal-link
matching, not in either of the two named files: `internal_linking/content_fetch.py` hardcodes
`STORE = "ledsone_uk"` and `SITE_BASE = "https://ledsone.co.uk"` — meaning the Internal Linking
content index itself only ever contains UK pages, regardless of what site is asking. This means
even after fixing `faq_schema.py`'s prompt text, a DE/FR blog's FAQ generation would still only
ever be offered UK internal links to mention. Documented in §10 as **D — needs further
investigation**, explicitly out of this audit's 2-file scope per the task's own instruction not
to expand scope unnecessarily, but flagged because it materially limits what the proposed
faq_schema.py fix can actually achieve for non-UK sites.

## 2. qa_check.py Finding

**File:** `backend/app/dev_tasks/blog_optimization/qa_check.py`
**Function:** `_check_product_collection_links(soup: BeautifulSoup) -> dict` (private, line ~87)

**Exact code (line ~107):**
```python
url = href if href.startswith("http") else f"https://ledsone.co.uk{href}"
```

**Current behaviour:** when checking a blog's product/collection links for validity, any
relative href (e.g. `/products/foo`) is resolved against `https://ledsone.co.uk`, regardless of
which site's blog is actually being checked.

**Why it exists:** `qa_check.py` was originally written when Blog Optimization only supported
`ledsone.co.uk` (before the 2026-10-06 GSC migration added `ledsone.de`/`ledsone.fr` as
confirmed-working sites). The hardcode predates multi-site support and was never updated when
multi-site support was added.

**Is it a bug or intentional fallback?** A real bug for the 2 sites added after this code was
written. Not intentional — no comment or logic anywhere treats this as a deliberate UK-only
design choice; it is leftover from before multi-site existed.

**Does Blog Optimization depend on it?** Yes, indirectly — `run_qa_check()` is called by Blog
Optimization's `GET /blogs/qa-check` endpoint for ALL 3 of its supported sites today
(`ledsone.co.uk`, `ledsone.de`, `ledsone.fr`), via `router.py`'s `blog_qa_check()`. A DE or FR
blog post with a relative product/collection link would be incorrectly checked against the UK
site right now — **this is a live, current-behaviour bug for Blog Optimization's own DE/FR
support, not only a future Blog HTML Automation risk.**

**Does any other Development Task depend on it?** No. Confirmed by a full-backend grep: the only
caller of `run_qa_check()` (and therefore the only path that reaches
`_check_product_collection_links`) is `blog_optimization/router.py`. No other Development Task
imports or calls anything from `qa_check.py`.

## 3. qa_check.py Caller Impact

| Caller | File:Line | Current Arguments | Depends on UK Fallback? | Proposed Impact | Risk |
|---|---|---|---|---|---|
| `blog_qa_check()` | `blog_optimization/router.py:272-287` | `run_qa_check(title=working["title"], html=working["html"], page_url=page)` — `page` is already the full blog URL (e.g. `https://ledsone.de/blogs/...`) | No — it already passes the real page URL; it just isn't used for the relative-link fallback today | Fixing the fallback to derive domain from the already-passed `page_url` requires ZERO change to this caller | **LOW** |
| `fix_duplicate_links()`, `fix_heading_structure()`, etc. (other QA-adjacent endpoints) | `blog_optimization/router.py` | Do not call `qa_check.py` at all (they call `html_fixes.py` directly) | N/A | None | **SAFE** |

Only one real caller exists, and it already has everything the fix needs.

## 4. faq_schema.py Finding

**File:** `backend/app/dev_tasks/faq_schema.py`
**Constant:** `_PROMPT_TEMPLATE` (line 86)

**Exact code (opening line):**
```
You are an SEO content specialist for ledsone.co.uk, a UK LED lighting e-commerce store on Shopify.
```

This single sentence is the entire hardcode — the rest of the prompt template uses the caller's
real `page_url`, `primary_keyword`, `existing_description`, and PAA questions, all passed in
dynamically. "UK English" is also explicitly instructed later in the prompt (`STEP 2` rule:
`"Use UK English (colour, metres, mains, fitting)."`) — a second, separate locale assumption in
the same template, listed in §10.

**Why it exists:** `faq_schema.py` was extracted 2026-10-06 from
`collection_thin_content/faq_generation.py` (per that module's own docstring), which was
originally written for `ledsone.co.uk` only — same history as the `qa_check.py` finding. The
brand/locale sentence was carried over verbatim during the extraction, not re-evaluated for the
new multi-caller, multi-store reality the extraction was explicitly meant to enable.

**Is it required, historical, unnecessary, safe, or dangerous?** **Historical and dangerous for
non-UK use.** Not required — the function already receives `page_url`, which contains the real
domain. Dangerous because: (a) it tells the LLM the page belongs to a UK store even when
generating FAQ content for a German or French blog post (Blog Optimization's 2 non-UK sites),
and (b) it hardcodes "UK English" spelling instructions regardless of the target locale.

## 5. faq_schema.py Caller Impact

| Caller | Function | Current Inputs | Uses UK Context? | Impact of Proposed Change |
|---|---|---|---|---|
| `blog_optimization/router.py:441` (`_run_faq_schema_fix`) | `generate_faq_schema(page_type="blog", page_url=page, ...)` | `page` is the real full blog URL — can be `ledsone.co.uk`, `ledsone.de`, or `ledsone.fr` (confirmed: Blog Optimization supports all 3 as of 2026-10-06) | **Currently forced to UK context regardless of actual site — this is the live bug** | Fix would make DE/FR FAQ generation correctly locale-aware for the first time; UK behaviour unchanged |
| `collection_thin_content/router.py:252` (`_generate_faq_job`) | `generate_faq_schema(page_type="collection", page_url=collection["collection_url"], ...)` | `collection_url` always comes from `content_fetch.py`'s hardcoded `STORE = "ledsone_uk"` / `SITE_BASE = "https://ledsone.co.uk"` (confirmed, see §1) — **always a real `ledsone.co.uk` URL today** | Yes, genuinely UK-only today — this caller cannot currently produce a non-UK `page_url` | **None** — this caller's own URL is always UK, so a domain-derived prompt would still correctly say "UK" for it; behaviour is unchanged for this caller either way |

Confirmed: fixing `faq_schema.py` to derive brand/locale text from `page_url` instead of a
hardcoded string changes nothing observable for `collection_thin_content` (its URLs are always
UK anyway) and fixes a real, live correctness gap for `blog_optimization`'s DE/FR calls.

## 6. Existing Store Configuration

Inspected `core/shopify_client.py` (the authoritative Shopify store registry) and
`blog_optimization/shopify.py` / `blog_optimization/gsc_sync.py` (the closest existing
per-site-domain config pattern):

- `core/shopify_client.STORES` — dict of Shopify store KEY → `{domain, token_env}`. Keyed by
  internal store name (`ledsone_uk`, `ledsone_de`, `ledsone_fr`, etc.), not by public-facing
  domain. Does not include locale/language/brand-label metadata.
- `blog_optimization/shopify.py`'s `SITE_STORES` — dict of **public-facing domain** (`
  ledsone.co.uk`, `ledsone.de`, `ledsone.fr`) → `(store_key, domain)`. This is the closest
  existing precedent for "given a real page URL, resolve to the right store/domain" — exactly
  the lookup both `qa_check.py` and `faq_schema.py` need.
- `blog_optimization/gsc_sync.SYNC_SITES` — dict of human-readable label (`"ledsone.co.uk"`,
  `"ledsone.de"`, `"ledsone.fr"`) → `(gsc_site_url, token_fn)`. Same shape of information from
  the GSC side.

**None of these existing structures carry locale/language metadata** (e.g. "UK English" vs
"German" vs "French") — only domain/store-key mappings. A fix for `faq_schema.py`'s "Use UK
English" instruction would need either (a) a small new locale-label lookup co-located with one
of these existing dicts, or (b) dropping the locale instruction to a generic
"use the appropriate regional spelling for this site" instruction and letting the LLM infer it
from the domain already in the prompt — the audit does not have enough information to prefer one
over the other without Kuberan's input on how strict the French/German spelling requirements are
meant to be; flagged as a decision point in §7, not resolved here.

**Approaches considered:**

| Approach | Verdict |
|---|---|
| A. Explicit `store` parameter added to `run_qa_check()`/`generate_faq_schema()` | Rejected — unnecessary signature change; `page_url` already carries this information in both real callers (see §3/§5) |
| B. Domain/site parameter | Same as A — redundant with existing `page_url` |
| C. Existing store configuration object (`shopify.py`'s `SITE_STORES` or similar) | **Recommended** — parse the domain out of the already-passed `page_url` via `urlparse`, look it up in a small existing-shape dict (reusing `SITE_STORES`'s domain-keyed pattern, or a focused local dict mirroring it) |
| D. Another existing pattern | No other existing pattern found that fits better |

**Recommended approach: C** — derive domain from the already-available `page_url` argument in
both functions (zero signature change, zero caller change), look it up against a small
domain-keyed config mirroring `blog_optimization/shopify.py`'s `SITE_STORES` shape. A safe
default (current UK behaviour) applies only when `page_url` is missing/unparseable or the domain
isn't in the lookup — preserving exact current behaviour for every existing caller.

## 7. Proposed Safe Fix (NOT IMPLEMENTED)

**qa_check.py:** In `_check_product_collection_links`, parse the real domain from the function's
own `page_url` (needs threading through — currently `_check_product_collection_links(soup)`
doesn't receive `page_url` at all, only `run_qa_check`'s top-level scope has it). Minimal change:
pass `page_url` down into `_check_product_collection_links(soup, page_url)`, use
`urlparse(page_url).hostname` as the resolve-against domain, falling back to
`"ledsone.co.uk"` only if `page_url` is `None` (preserves exact current behaviour for any
caller that doesn't pass one — none currently exist, but this keeps the function's own public
default safe).

**faq_schema.py:** In `build_prompt()` (or the caller `generate_faq_schema()` just before
building the prompt), derive the domain from `page_url` the same way, and look it up in a new,
small domain → `{brand_label, locale_instruction}` dict (e.g.
`{"ledsone.co.uk": {...UK...}, "ledsone.de": {...DE...}, "ledsone.fr": {...FR...}}`), falling
back to the current UK text only if the domain isn't recognized. **Open question for Kuberan**
(not resolved by this audit): what should the actual German/French brand-label and
spelling-locale instruction text say? This needs a real decision, not an inferred default, since
getting it wrong would silently produce lower-quality FAQ content for DE/FR rather than an
obvious error.

Both proposed fixes: reuse existing store configuration shape (no duplicate config), preserve
every existing caller's exact current behaviour (UK default unchanged), support future
multi-store use, avoid a new magic default beyond what already exists (UK stays the fallback,
matching today's actual behaviour), fully backward-compatible.

## 8. Dashboard Regression Risk

| Area | Classification | Basis |
|---|---|---|
| Blog Optimization | **LOW RISK** (would FIX a live bug for DE/FR, not introduce one; UK path unchanged by construction) | Only real caller of both functions; confirmed via full-backend grep |
| Collection Thin-Content Detector | **SAFE** | Only ever passes UK URLs (confirmed via `content_fetch.py`'s hardcoded `STORE`/`SITE_BASE`); domain-derived fix produces identical behaviour to today for this caller |
| Content Gap | **SAFE** | Does not import or call `qa_check.py` or `faq_schema.py` (confirmed via grep — no matches) |
| Internal Linking | **SAFE for this fix** — but see §1/§10: its own separate hardcode (`content_fetch.py`'s UK-only `STORE`) is a related, NOT-in-scope risk that limits how useful the faq_schema.py fix can be for non-UK internal-link suggestions | Confirmed via direct read of `internal_linking/content_fetch.py` |
| Meta Title & Description Audit | **SAFE** | No calls to either file found |
| AI/GEO Visibility | **SAFE** | No calls to either file found |
| Structured Data Validation | **SAFE** | No calls to either file found |
| GSC tools (`search_console_indexing`, `search_intent_page_action`) | **SAFE** | No calls to either file found |
| Alt Text Keyword Finder | **SAFE** | No calls to either file found |
| Top 10 Blog Title Finder | **SAFE** | No calls to either file found |
| Any other Development Task | **SAFE** | Confirmed via full-backend grep for both `qa_check\.` and `faq_schema\.`/`generate_faq_schema` — no other matches outside the 2 confirmed callers |
| Shared frontend/dashboard behaviour | **SAFE** | Both are pure backend functions; no frontend code references either file |
| Existing scheduled tasks / background jobs | **SAFE** | Neither function is called from any `ScheduledSnapshot` or scheduler module (confirmed via grep for `qa_check`/`faq_schema` imports across `scheduler.py` files — no matches) |

No UNKNOWN classifications remained after the grep-based verification above — every claim here
is grep/read-confirmed, not assumed.

## 9. Blog HTML Automation Impact

Directly enables 2 of the Step 1 audit's flagged "extend" items:
- `faq_schema.generate_faq_schema()` would correctly produce locale-appropriate FAQ content for
  whichever site Blog HTML Automation is generating a page for, instead of always assuming UK —
  a prerequisite for the Step 1 audit's planned multi-store use.
- `qa_check.py`'s product/collection link validation would correctly resolve relative links for
  the actual target site, rather than silently checking the wrong domain for DE/FR pages.

**Does NOT fully solve multi-store safety on its own** — the Internal Linking content index
hardcode found in §1/§10 means internal-link SUGGESTIONS themselves would still be UK-only
regardless of this fix, until that separate, out-of-scope issue is also addressed. Blog HTML
Automation's Step 2 design should account for this gap explicitly (e.g. treat internal-link
suggestions as UK-only / not-yet-available for DE/FR generation, until `internal_linking` itself
is extended).

## 10. Additional Hardcode Findings

| Finding | File | Category |
|---|---|---|
| `STORE = "ledsone_uk"`, `SITE_BASE = "https://ledsone.co.uk"` | `internal_linking/content_fetch.py` | **D — needs further investigation.** Upstream of `faq_schema.pick_internal_links()`'s data source; out of this audit's named 2-file scope, but directly limits what the faq_schema.py fix can achieve for non-UK sites (see §9). Not expanded further here per the task's explicit "do not expand scope unnecessarily" instruction. |
| `"Use UK English (colour, metres, mains, fitting)."` instruction in `faq_schema._PROMPT_TEMPLATE` | `faq_schema.py` | **A — must fix now**, same root cause and same fix location as the brand-name hardcode in §4; listed separately here because it's a second, distinct sentence in the same template, easy to miss if only the opening brand sentence is edited |
| `https://ledsone.co.uk{href}` fallback | `blog_optimization/qa_check.py` | **A — must fix now** (this is the primary finding, §2) |
| `SITE_STORES`/`SYNC_SITES` domain-keyed dicts in `blog_optimization/shopify.py`/`gsc_sync.py` | `blog_optimization/` | **B — safe, intentional, already correctly multi-store** (confirmed during the 2026-10-06 GSC migration audit) — included here only for contrast, not a risk |
| `core.shopify_client.STORES` | `core/shopify_client.py` | **C — unrelated/out of scope.** This is the correct, already-generic store registry; not a hardcode risk itself |

No other `ledsone.co.uk` / fixed-domain / fixed-brand occurrences were found specifically within
`qa_check.py` or `faq_schema.py` beyond the ones listed above — confirmed via a full read of
both files (not a partial grep).

## 11. Exact Files That Would Change (proposed, NOT implemented)

| File | Function | Proposed Change | Why | Risk |
|---|---|---|---|---|
| `backend/app/dev_tasks/blog_optimization/qa_check.py` | `run_qa_check()`, `_check_product_collection_links()` | Thread `page_url` into `_check_product_collection_links`; derive resolve-against domain from it via `urlparse`, fallback to current `ledsone.co.uk` only if absent | Fixes the live DE/FR relative-link-checking bug | LOW |
| `backend/app/dev_tasks/faq_schema.py` | `build_prompt()` or `generate_faq_schema()` | Derive brand label + locale-spelling instruction from `page_url`'s domain via a small new lookup dict, fallback to current UK text if domain unrecognized | Fixes locale-incorrect FAQ generation for DE/FR Blog Optimization calls; prerequisite for Blog HTML Automation multi-store use | LOW (pending Kuberan's decision on actual DE/FR prompt text, see §7) |

No other files need to change for this specific fix. `internal_linking/content_fetch.py` is
NOT included here — it is a separate, out-of-scope finding (§10), not part of this approved-scope
fix.

## 12. Implementation Plan (for AFTER approval — NOT executed)

1. Add `page_url: str | None = None` parameter to `_check_product_collection_links()`, update
   its one call site in `run_qa_check()` to pass it through.
2. Replace the hardcoded `f"https://ledsone.co.uk{href}"` with a domain derived from
   `urlparse(page_url).hostname` when `page_url` is present and parses to a real hostname;
   keep `"ledsone.co.uk"` as the literal fallback when it doesn't (preserves current behaviour
   exactly when no URL is available).
3. In `faq_schema.py`, add a small domain → `{brand_label, locale_instruction}` lookup (exact
   DE/FR text to be confirmed with Kuberan first — do not invent wording), derive the domain
   from `page_url` the same way as step 2, fall back to current UK text for an unrecognized
   domain.
4. Update `build_prompt()`'s call site inside `generate_faq_schema()` to pass the derived
   brand/locale text instead of the hardcoded string.
5. Run the validation plan in §13.

## 13. Validation Plan (for AFTER approval — NOT executed)

- `python -m py_compile` on both changed files.
- `python -c "import app.main"` backend import check.
- Direct import check of `blog_optimization` and `collection_thin_content` routers (both real
  callers) to confirm no import-time error.
- Targeted function call: `qa_check.run_qa_check()` against a real UK blog (confirm identical
  output to today) AND a real DE or FR blog (confirm it now resolves relative links against the
  correct domain instead of UK).
- Targeted function call: `faq_schema.generate_faq_schema()` against a real UK collection
  (confirm identical prompt/output to today) AND a real DE or FR blog (confirm the prompt now
  reflects the correct domain/locale).
- Confirm no other file changed (`git status` / `git diff` limited to exactly the 2 files listed
  in §11).
- Confirm no new hardcoded store/domain value was introduced anywhere in the fix itself (the
  fallback value is the ONLY literal domain string remaining, and it exactly matches today's
  existing behaviour, not a new one).

## 14. Final Recommendation

**APPROVE WITH CONDITIONS.**

The `qa_check.py` fix is self-contained, fixes a real live bug, zero caller impact, ready to
implement as described. The `faq_schema.py` fix is also low-risk and zero-caller-impact, but
**needs one explicit decision from Kuberan before implementation**: the actual German and French
brand-label/locale-instruction text to use (not something this audit should invent). Implement
`qa_check.py`'s fix on its own merit; implement `faq_schema.py`'s fix once that text is
confirmed. The related `internal_linking/content_fetch.py` hardcode (§10) is explicitly NOT part
of this approval — flagged for a separate, future audit/decision.
