# Prompt — salesuk.html: Not Assigned Order Assignment UI

**Title:** Assign-from-UI for the Not Assigned tab
**Purpose:** Let a user pick an order in Not Assigned, choose which person/group it belongs to from a dropdown, and assign it (across both 2025 and 2026 tabs) — the feature flagged as deferred since 2026-07-28 ("needs a GitHub token or equivalent").
**Requirement Source:** User request, 2026-07-29 — "now i need option to assigend the order in the not assigned the tab - select and add need to select the belongsperson in a drop and assigned that order which tab (year)"

## Scope decisions (asked up front)
- **Persistence:** Permanent, via GitHub — a Vercel env var `GITHUB_ASSIGN_TOKEN` (a GitHub PAT with write access to `Staff-requirements`) lets a new endpoint commit assignments directly to the repo, so they survive redeploys and are visible to everyone. User asked to add this token to Vercel themselves rather than pasting it in chat.
- **Applies to:** Both the 2025 (`sales25.js`) and 2026 (`salesuk.js`) Not Assigned tabs, built once and shared.
