# Kamsi Organic Sales Rule — Common Prompt

**Purpose:** Reusable prompt to apply the correct "organic sales" definition whenever building or auditing sales reports/dashboards for Kamsi (SEO team, ledsone.co.uk).

## Prompt

```
Apply Kamsi's organic sales definition for ledsone.co.uk:

Organic sales = all sales EXCEPT paid advertising.

INCLUDE:
- Direct traffic (typed URL, bookmarks)
- Referral traffic (other websites)
- No data / unknown attribution
- AI tools (ChatGPT, Perplexity, etc.)
- Google / Bing organic search (no ads)

EXCLUDE:
- Google Ads / Shopping Ads
- Facebook / Instagram Ads
- Paid email campaigns

Filter OUT paid ad sources only — everything else counts as organic and
should be attributed to Kamsi's SEO team performance.
```

## Notes
- Kamsi is on the SEO team; this metric measures SEO's revenue contribution.
- Separate from the (not currently live) "No Journey Data" order-reassignment
  logic that moves specific Kamsi/Dilaksi orders to Theekshy/Sonya based on
  Google Ads click-evidence — that's an attribution correction, not this
  organic-sales filter. See memory: project_theekshy_kamsi_dilaksi_reassignment,
  project_sonya_kamsi_dilaksi_reassignment_pending.
- Source: memory `project-ledsone-organic-sales-definition`.

**Status:** Reference prompt only, no code change.
**Reviewer:** —
**Next step:** Use this prompt verbatim when asked to build/audit Kamsi organic sales reporting.
**PASS/FAIL:** N/A (reference doc)
