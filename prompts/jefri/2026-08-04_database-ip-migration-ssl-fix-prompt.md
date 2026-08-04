# Jefri Req1/Req2 — Database IP Migration + SSL Fix (Prompt)

**Date:** 2026-08-04
**Team member / Team / Store:** Jefri / Google Ads / ledsone.de

## Original request

User reported Requirement 1 was stuck showing stale data (no newer than 2026-07-29), then
reported that a developer was changing the database host IP. Asked for help updating the
connection, diagnosing each failure as it occurred, and getting both Requirement 1 and 2
working again — conducted over several screenshots/back-and-forth rather than a single
written spec.

## Task scope as it unfolded

- Diagnose the original data-staleness issue.
- Update `DATABASE_URL` to the new host as credentials were provided (in stages).
- Diagnose and fix each connection failure (missing module, wrong db name, network timeout,
  SSL requirement) as it appeared.
- Extend the fix to Requirement 2 once it was found broken by the same root cause.
