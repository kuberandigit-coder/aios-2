---
date: 2026-07-13
staff: Jakshan
requirement: Requirement 1 & 2 (built by contributor Piranav)
type: evidence
---

# Jakshan Req1 & Req2 — Production Regression Fix — Evidence

## Discovery

While handling an unrelated request ("push jakshan.html also to vercel"),
compared local `aios-2` checkout's `jakshan.html` against the
`Staff-requirements` repo clone:

```
diff: DIFFERENT
local (aios-2):            24 lines  (old stub)
Staff-requirements clone:  511 lines (Piranav's live GSC+Shopify build)
```

Confirmed live production was serving the OLD stub via curl:
```
curl https://digital-marketing-member-pages.vercel.app/pages/jakshan.html | wc -l
→ 26 lines (matches old stub, not the 511-line live version)
```

## Root cause

A manual `vercel --prod` deploy had been run earlier from the local
`aios-2` checkout (`reports/digital-marketing-member-pages/`) to publish
unrelated Thasitha/Kamsi changes. Since Vercel CLI deploys whatever is on
local disk for the entire directory — not just the files intentionally
changed — and the local copy of `jakshan.html` had never been synced with
Piranav's `Staff-requirements` commit, that deploy silently regressed
Jakshan's live dashboard back to the old stub.

## Structural bug found while restoring

Running the div-balance validator (see AI Knowledge doc) on the correct
511-line version found: **76 opening `<div>` tags vs 75 closing** — a real
bug, not the regression.

Traced with a per-line depth counter; found `<div id="req1-section">`
(opened line 76) was never closed — the file jumps straight from
Requirement 1 content into `<div id="req2-section" style="display:none">`
(line 443) without closing Requirement 1's wrapper first.

**Fix applied**: inserted `</div>` immediately after the closing
`</script>` tag of Requirement 1's section (line 440-441), before the
Requirement 2 HTML comment/div begins.

## Validation before deploy

```
node --check <extracted first <script> block>  → OK
div-balance check                                → 76 open / 76 close (fixed)
```

## Files modified

- `reports/digital-marketing-member-pages/pages/jakshan.html` — synced
  correct 511-line version from `Staff-requirements`, added missing
  `</div>`.

## Deployment evidence

- Production verified: `curl .../pages/jakshan.html | wc -l → 512` (200 OK)
- Repos: `aios-2@b0c8f07`, `Staff-requirements@0d8e64f`
- Later same day, a GitHub Actions auto-update
  (`.github/workflows/jackshan_daily.yml`,
  `scripts/jackshan_auto_update.py`) pushed a further small data-only
  update (`42ef77f` on `Staff-requirements`) — re-validated after merge,
  still 76/76 balanced (the earlier fix persisted correctly).
