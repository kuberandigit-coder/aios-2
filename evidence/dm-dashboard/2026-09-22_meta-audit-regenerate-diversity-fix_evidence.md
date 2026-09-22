# Evidence — Meta Title & Description Audit: Regenerate produced identical output + log tab couldn't change keyword

Date: 2026-09-22
Repo: dm-dashboard (dev_tasks/meta_audit), pushed to `dev-work` only

## User report

Screenshots showed: (1) generated with the wrong keyword, corrected it,
clicked Regenerate — result didn't change; (2) on the Generated Titles/
Descriptions log tab, Regenerate produced only a trivial tweak to the
description and the title came back byte-for-byte identical.

## Root cause investigation (live-tested, not guessed)

Live-tested the exact backend call for the exact real product from the
screenshot with two different keywords — worked correctly (genuinely
different output), ruling out the Missing Metadata tab's own button as
broken. Found the real bug in the **separate** log-tab Regenerate button:
`regenerateLogEntry()` always reused `g.keywordsUsed` (the ORIGINAL
keyword) with no input to change it — structurally impossible to correct
a wrong keyword from that tab.

Then live-tested regenerating the SAME keyword twice — confirmed a
second, more serious root cause: the LLM call had **no temperature set
at all**, so identical prompts produced identical/near-identical output
by default. The prompt also had zero awareness it was a regenerate.

## Fixes

1. `temperature=0.9` added to the local LLM call (previously unset).
2. New "previous version" block injected into the prompt whenever a
   prior generation exists for that URL/field (new
   `schema.get_generation_log_entry`/`get_latest_generation`) —
   explicitly instructs the model to produce a genuinely different
   version, not a near-copy.
3. Log tab's "Keywords Used" column made an editable input; Regenerate
   now uses the edited value if present.

## Live verification

- 3 consecutive regenerates on the same real product/keyword -> 3
  genuinely distinct titles (previously identical/near-identical).
- Full router-level test with `replaceLogId` (the log tab's exact
  code path) -> confirmed different description text, real DB round
  trip, cleaned up.
- **Re-verified directly on production** after deploy: two live
  `POST /generate-missing` calls on the same real product/keyword via
  curl returned genuinely different titles. Test log rows (id 51, 52,
  `generatedBy='Live Verify'`) deleted after confirming.

## Status

Implemented, live-tested (locally and in production), pushed to
`dev-work` only (commit `d380483`). Confirmed working in production the
same day.
