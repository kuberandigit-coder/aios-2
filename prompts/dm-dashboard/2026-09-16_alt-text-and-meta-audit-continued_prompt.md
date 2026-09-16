# Task Framing — Alt Text Optimization (continued) & Meta Title/Description Audit relocation + keyword workflow

**Date:** 2026-09-16
**Repo:** dm-dashboard, `dev-work` branch (merged to `main` today via Dev Tools)
**Requested by:** Kuberan

This session covered two continuous workstreams in one long conversation.
Unlike Dilaksi Requirement 07 (a single upfront written spec, see its own
prompt record), these were a running series of live bug reports and
feature requests given turn-by-turn as real problems surfaced on the
production page. This file preserves the substance of what was asked, in
the user's own terms where practical, not the implementation notes
(those live in the evidence/handover records).

---

## Workstream 1 — Alt Text Optimization (continuing from 09-15)

Chronological asks, each in response to a real screenshot/live symptom:
1. "for genrating taking too much time and faild" / navigating tabs felt
   like loading, and the tab buttons looked wrong (filled green) — asked
   for a smooth transition and a better button UI, "do the page perfect
   layout... user need to use easy and smoothly."
2. Reported the local LLM down (DNS resolution failure on
   `qwen3_next.severdigitweb.uk`) — asked to "use gemini for today i need
   to finidh the task," i.e. add an automatic fallback so work wasn't
   blocked.
3. Reported the Missing Metadata equivalent problem for Alt Text: a
   collection's whole-catalog generation was timing out (504) — asked to
   fix it so it doesn't hang/fail on large collections.
4. Asked for a hard cap: "if a collection more than fivty produuuct when
   select show as more than fifty and only can run fifty and after run
   when a user select the same collectio need to start with the 51" —
   batch-limit generation to 50 per visit, auto-continue next time.
5. Asked "i need to know how any units gone" and "tell me if run ones
   where i can see again the runned" — wanted visibility into what had
   already been generated, without re-running.
6. Asked for "stop the run button and start again button" — a Stop
   control for the in-progress background job, and Resume that picks up
   exactly where it left off.
7. Reported that a collection stayed "in progress" across multiple
   visits with no explanation — asked to find out why.
8. Reported the live server itself broken after a push: a build error
   (`[UNRESOLVED_IMPORT] SeoSerpRankTracker`) — asked what the file was
   for, then explicitly: "no need remove that whole file from local and
   git" (a teammate's incomplete, never-committed feature was referenced
   by committed registry files).
9. Reported the local LLM down again — this time traced to a real typo:
   confirmed `https://qwen3next.severdigitweb.uk/` (no underscore) was
   the working host, asked to "check and need to update in the system."

## Workstream 2 — Meta Title & Description Audit

1. Explicit correction after the feature was first built as "Dilaksi
   Requirement 07": "i said this is not dilaksi req 7 this is the dev
   task so in admin page add under the development task and user access
   managemnt only fremove from others and move the coded to correct
   places" — relocate the entire feature out of Dilaksi's own pages into
   the generic Development Tasks area, gated only by User Access
   Management, same as every other dev tool (Alt Text Keyword Finder,
   Content Gap Analysis, etc.).
2. A round of UI/UX requests on the relocated page: "give to this better
   css and need more detailed view... add better css look to the url
   also... made this view also better view arrange in perfect layout" —
   plus "in last tell me is the data is store in database or direct raw
   live data" (answered: stored, snapshot-based).
3. Reported the whole result table felt slow, and tab buttons looked
   wrong (same class of feedback as Alt Text) — pagination + smooth
   transitions + tab redesign requested.
4. New feature request, given as an explicit workflow: "i need to
   genrate the meta description mising product and meta ttitle missing
   and both by per product... input feild for input the key word...
   select a product and iput the keyword from semrush and click genrate
   with the keyword" — plus the two EXACT prompt templates to use for
   title generation and description generation (reproduced verbatim in
   the evidence record), and "for gnrate use local llm api, i need this
   option for missing eta data tab only."
5. Investigated whether Semrush's API could be used directly instead of
   manual copy-paste — user asked "with the semrush mcp connecter
   possible?" and "can we schdule or trigger button in dashboard to use
   claude mcp connecter?" (answered: MCP is chat-session-only, cannot be
   called by the live backend; recommended against a fragile queue+cron
   workaround).
6. Asked to actually try it: "try for only 3 product and update the data
   in the postgress, create a table for store keyword and show in the
   dahsboard for just 3 - i need to know how any units gone to the 3."
7. Iterative simplification requests, each explicit:
   - "keep input also" (confirm the manual keyword field stays)
   - "only key word is enough... dont show the voloum cc and others...
     i think in this way we can save the unit" (clarified: doesn't
     reduce Semrush cost by itself, but simplified anyway)
   - "no need primary and secordary add mulitple key words in the input
     feild and when click genrate need to genrate title with all
     muliple keyword from the input feild"
   - "do not gather other just read the datas and take desision and
     finally gather the keywords only i think this is save the unit"
     (confirmed: one Semrush lookup per product, zero-cost analysis on
     the already-fetched data, no follow-up calls)
8. Reported the Generate button visibly not working after a keyword was
   already saved — asked to check; found live via browser network-tab
   inspection.
9. Final round: "if only title is missing need to genrate title and
   genrate also and if missing description only need to genrate title
   also" (clarified as: always generate BOTH regardless of which is
   actually missing) + "delete option in Generated Titles/Descriptions
   page" + "in every title showing by ledsone so remove by dont add but
   and add | befroe ledonsone for all title genration."
10. "leave user can mannually update the kmeywords and genrate the title
    and description so i need to store the runned, i mean genrated
    prodyucts in a new tab... which user run" — the Generated
    Titles/Descriptions log tab.

---

**Note on this preserved copy:** these are paraphrased/lightly cleaned
summaries of real chat messages (including typos), not literal
reproductions of every message — the exact wording is in the session
transcript if ever needed. Nothing in the implementation deviated from
what's captured here; see the evidence record for what was actually
built in response to each point.
