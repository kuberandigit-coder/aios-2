# Prompt — Collection Page Thin-Content Detector, Level 1

Date: 2026-09-21
Repo: dm-dashboard

## Original request (condensed)

Full formal task spec: "TASK: Dilaksi — Collection Page Thin-Content Detector — LEVEL 1". Build audit +
prioritization + backlog workflow only for LEDSone UK collection pages. Explicitly excludes AI content
generation, content brief generation, live/before-after preview, automatic Shopify writes, and any Level
2/3 functionality. Pipeline: Shopify Collection Data -> Content Extraction -> Word Count -> Threshold Check
-> FAQ Content/FAQ Schema Check (checked SEPARATELY) -> GSC Search Performance -> Priority -> Content
Backlog. Both the minimum-word-count threshold and the high/low-traffic split had to be searched for first
in the existing project/AIOS before building any priority logic — if not found, made configurable rather
than invented. Full spec preserved in this session's own conversation record.
