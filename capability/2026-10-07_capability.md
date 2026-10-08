# Capabilities — 2026-10-07

Blog HTML Automation's post-Step-3 feature stream (29 commits, 13:38-17:59). Most of this reused
existing systems (see "new consumer" notes added same day to `2026-07-24_capability.md` and
`2026-08-24_capability.md`) — 2 genuinely new reusable patterns below.

## Capability — Visual Block Editor (click-to-edit rendered HTML, auto-save)

### Capability

A "Customize" editor letting a user click directly on a rendered block inside a generated page
preview to remove or recolor it, auto-saving the change back into the stored HTML — rather than
editing raw HTML or a separate structured form. Required tagging every top-level generated block
with a stable identifier first (`data-link-id` for inline links, a block-tag scheme for top-level
blocks) so a click in the rendered preview can be mapped back to the exact region in the stored
source.

### Originating task

`evidence/dm-dashboard/2026-10-07_blog-html-automation-post-step3-feature-additions_evidence.md`
(commits `5a84763`, `74ba354`, `a710012`)

### Reuse

The "tag every generated block with a stable ID, then let a click in the rendered preview map back
to that exact region in the source" technique is reusable for any future feature letting a user
visually edit AI-generated or templated HTML without exposing raw markup.

---

## Capability — Parallelized AI Section Generation

### Capability

Generation of a multi-section page was switched from sequential per-section AI calls to
parallelized calls, cutting total generation time — later refined same day with background
processing (one product at a time) and capped AI timeouts to keep individual requests responsive.

### Originating task

Same evidence file, commit `dc1d0c0` and the day's final commit `8330437`.

### Reuse

The general shape (parallelize independent AI calls that don't depend on each other's output,
background the slowest/least time-critical one) is reusable for any future multi-part AI generation
feature on this project — see also `2026-09-15_capability.md`'s background-generation pattern for
Alt Text, a closely related technique from the same codebase.
