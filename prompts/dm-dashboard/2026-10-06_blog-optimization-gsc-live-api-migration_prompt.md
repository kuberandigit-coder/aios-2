# Task Framing — Blog Optimization: GSC live API migration + applied-fix persistence

**Date:** 2026-10-06
**Repo:** dm-dashboard, `dev-work` branch (merged to `main` through the day via Dev Tools)
**Requested by:** Kuberan

A long, running session of live asks given turn-by-turn in response to real screenshots and
production state, not one upfront spec. Preserved here in the user's own terms where practical;
implementation detail lives in the evidence/handover records.

## Workstream 1 — review-then-apply fix system (morning)

1. "need regenrate option for these 3" (meta title length, meta description length, FAQ content
   matches visible FAQ — regenerate buttons for already-generated fixes).
2. A detailed workflow correction given as one long message: user view the optimize page →
   analysis/performance/queries/cause → view the QA check → fix issues one at a time by
   clicking Fix → view result → Apply if correct, Regenerate if not → after Apply the change
   updates in Current Blog HTML below → preview → copy and update manually in Shopify. Asked to
   "fix this perfect."
3. "remove all the account and check the env file for which account GSC api available ?" —
   referring to the 8-site dropdown shown in a screenshot.
4. "dont use the buisness data for the gsc data can we use the dirct api available in the env
   file ?"
5. Clarified mid-conversation that the original ask was simpler than the exploration suggested:
   "for that only i asked for which gsc api availabe ?"
6. "so can we change from use the api to gather data and update in my dm dashboard app database
   and show here for the avalabe aoi kry , befor this lust which account api are available
   ledsone uk and de and other ?" — explicit instruction to list working accounts BEFORE
   building anything.
7. Final, authoritative instruction (with screenshot): "ok do for that available 3 account
   first disconnect buiseness database writ e write code for call api and gather need data for
   the blog optimize page and create table in the dm dashboard databse and update all the data
   in stctured way in the postgress of mine and then show in the frontend for that available
   account only and add secheduler for this for every week and add monitir in the sync monitir
   also."

## Workstream 2 — Sync Monitor follow-up

8. "did you add sync monitor for this sechfule ?"
9. Screenshot showing the new entry missing from the Sync Monitor sidebar — "here still not"
   / "why check the sync monitor code and already added i need that extact monitor page for
   this task for other task already added monitor."

## Workstream 3 — data correctness follow-up

10. "check the quri is not shoing can you analysi why ?" — then, once it became clear query
    data was still filling in for non-blog-classified pages and recently-synced blog pages,
    "ok leave quroes alos comming."
11. "did you push to dev work" / "push to branch" — confirming the push location (standing
    rule: `dev-work` only, never `main` directly, per earlier session instruction).

## Workstream 4 — UI feedback (live screenshots)

12. "when a fix applied... here default show the previe while open not code" — Current Blog
    HTML should default to the Preview tab.
13. "when scroll down the whole header is hidden need to scrool up and click so can you please
    set for show always only that navigation while scrolling down possible yes or no ?" —
    followed by a second report after the first deploy that it still wasn't sticky, which led to
    live-verifying the deployed CSS/JS bundles directly rather than guessing.
14. "only ledsone uk api is connected right ?" then "need to connect de and fr also."

## Workstream 5 — persistence + locate-changes (final ask of the day)

15. "aftr click apply and change for the fix need to show as applied and fixed permerne nt in a
    table view in colpleted tab... next to the owner a button need view changes and view the
    changes any time create needed table in the databse and finish all the task with best ui
    and veray user frendly and smooth and speed page." Earlier in the same thread: "here i need
    view the changes by clcick a button name locate changes is this possible add this too and
    pish to dev work" and "here also need changed button when a user manually update in the
    shopify and need to clcik as changed."

---

**Note on this preserved copy:** paraphrased/lightly cleaned summaries of real chat messages
(including typos, kept as-is where they don't obscure meaning), not literal reproductions of
every message. Nothing in the implementation deviated from what's captured here; see the
evidence/closure records for what was actually built in response to each point.
