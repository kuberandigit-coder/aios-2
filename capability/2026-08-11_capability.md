# Capabilities — 2026-08-11

## Capability — Auth-Guard Auto-Insertion Regex Gap (security gotcha)

**Date:** 2026-08-11
**Owner:** Kuberan
**Project:** digital-marketing-member-pages
**Status:** Fixed, deployed, verified live same day

### Capability (a documented security failure mode, not a feature)

When gathering a new page from another source (here, Piranav's Staff-requirements-02 project) and
auto-inserting this project's standard `dm_session` auth guard via a script, **the insertion
script's regex assumed no content between `<title>` and `<style>`.** Both affected pages
(`seo.html`, `organic-revenue.html`) had a `<script src="chart.js">` tag in between, which the
regex didn't account for — so the guard was **silently never inserted**, with no error or warning.

### Impact

Both pages were fully loadable, unauthenticated, with complete data visible, for the period
between gathering and the same-day manual audit that caught it.

### Fix

Insert the guard block positionally relative to the actual `<script>` tag present, not assuming a
fixed template shape immediately after `<title>`.

### Originating task

`evidence/muguntha/2026-08-11_seo-organic-revenue-missing-auth-guard-security-fix.md`

### Reuse

**Any future automated auth-guard insertion on a newly-gathered page from an external source must
not assume a fixed template shape** — verify the guard actually landed in the output, not just
that the script ran without erroring. The task's own recommendation: audit any other page gathered
via the same automated insertion script for this same regex gap if more are added later.
