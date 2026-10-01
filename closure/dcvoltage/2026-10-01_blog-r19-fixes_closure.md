# Closure — DC Voltage Blog R19 Fixes ("E27 vs B22 vs GU10")

**Date:** 2026-10-01
**Store:** dcvoltage.co.uk
**Requested by:** Mani (listing corrections channel)
**Deadline:** 2026-10-01, 17:00 Sri Lanka time
**Follows on from:** [[2026-09-30_e27-model-phase1a_closure]]

## Purpose

Mani's post-approval re-check of the earlier E27 model task flagged 2 open items that needed fixing before
the task could be marked fully done.

## What was fixed

1. ST64 ~1025 product SEO title → "Dimmable ST64 E27 LED Filament Bulb, Amber ~1025 | DCVOLTAGE"
2. Blog post "E27 vs B22 vs GU10":
   - Removed the duplicate H1 (content block's own `<h1>` → `<h2>`, theme's blog-title H1 is now the only H1)
   - Added the missing link to `/collections/e27-bulbs` on the "Shop E27 Bulbs" CTA
   - Added FAQPage JSON-LD schema from the 6 existing FAQ Q&As
   - Added the blog post's meta description

## Real bug found and fixed mid-task (not in original scope, but blocking)

Shopify's blog content editor strips `<style>` tags on save, even via the `</>` HTML source view — the first
pasted fix rendered completely unstyled live (confirmed via screenshot: plain text, oversized hero image,
unstyled FAQ buttons). Rebuilt the entire stylesheet as inline `style=""` attributes using CSS custom
properties, which survive Shopify's sanitizer. Re-pasted and confirmed live — fully styled.

## Explicitly out of scope / left as-is

"Shop GU10 Bulbs" button links to `/collections/gu10-bulbs`, which 404s. Pre-existing in the original content,
not introduced by this task. Kuberan's explicit instruction: "leave that 404." Not fixed.

## Evidence / Validation

- [[2026-10-01_dcvoltage-blog-r19-fixes]] (evidence)
- [[2026-10-01_dcvoltage-blog-r19-fixes]] (validation)
- Daily log: [[2026-10-01_daily-work-log]]

## Files changed

- `dcvoltage-e27-model/e27-vs-b22-vs-gu10-guide-FIXED.html` (superseded, kept for reference)
- `dcvoltage-e27-model/e27-vs-b22-vs-gu10-guide-INLINE.html` (final, live)
- Shopify admin: ST64 product SEO title, blog post body + meta description (live edits, not in git)

## Status

**Done.** Both of Mani's flagged items fixed and confirmed live via screenshots. Kuberan to send
"R19 done" to Mani to close out the loop. No further action needed from this side unless Mani's own
re-check surfaces something new.
