# Daily Work Log — 2026-08-12

## Summary
Resolved a Google Safe Browsing "Dangerous site" flag on the primary `.vercel.app` domain by connecting a real owned custom domain (infra work, no git commits); permanently removed a legacy login-popup flash bug on 6 pages; added the real LEDSone logo as favicon/brand mark; redesigned `sales2.html`, `salesuk.html`, `sales25.html`, `2025DE.html` with the same navy collapsible sidebar as `thasitha.html` (including professional SVG icons, replacing an initial emoji-icon pass); removed the now-unused `.vercel.app` alias; attempted a Performance-tab speed optimization on `muguntha.html` for Sonya that caused real production errors, fully reverted.

## Tasks Completed

1. **Jefri Req4 cross-repo sync bug — root cause + fix** — user reported Req4 stuck loading/showing wrong data again. Root cause: the `jefriReq4MappingHandlerModule` backend handler (built 2026-08-11, `ea6fa76` et al.) had been pushed to `aios-2` but never synced to `Staff-requirements`, which is the repo Vercel's `digital-marketing-member-pages` project actually builds from — so the live API silently fell through to an unrelated handler returning SEO/blog data instead of item-mapping data. Fixed by copying the missing block into the `staff-req-sync3` worktree and pushing to `Staff-requirements`. **No dedicated commit hash in `aios-2`** since the fix was a sync-only push to the other repo; confirmed live via curl showing correct `itemId`/`parentProductId` JSON. This is the second time this exact class of bug occurred (file present in one repo, missing in the other) — reinforced the standing "always push both repos, every time" rule (`feedback_dual_repo_push_always` memory). **Manual Verification Required:** exact date this rule was first adopted is not confirmed from git history alone (it governs dual-repo push behaviour, not a single commit).

2. **Google Search Console site-verification file** (`43eb08e`): added `googlebb3d8c1bfef3e723.html` at the project root, for ownership verification of `https://digital-marketing-member-pages.vercel.app` as part of the Safe Browsing review-request flow (item 3 below).

3. **Google Safe Browsing "Dangerous site" crisis — resolved via custom domain (infra-only, no git commits)**: the primary `.vercel.app` production URL was flagged by Google Safe Browsing under "Deceptive pages" (a login-form pattern on a free/shared platform subdomain is a common false-positive trigger), confirmed via the Google Transparency Report API and Search Console → Security Issues. Actions taken:
   - Submitted a Search Console review request for the flagged domain (item 2's verification file) — status still pending as of this date, now lower priority.
   - Set up a temporary, standalone, no-login Vercel project (`eod-public`, at `https://eod-public.vercel.app/eod.html`) containing only `eod.html`/`eod-ads.html`/`eod-seo.html`/`eod-tec.html` with the auth guard stripped, so the team had uninterrupted EOD access while the main domain was flagged. This project is **not tracked in either `aios-2` or `Staff-requirements`** — it lives at `C:\Users\PC\OneDrive\Desktop\eod-public\` and was deployed directly via Vercel CLI. Explicitly kept original filenames (not renamed to `index.html`) per direct instruction.
   - Connected a real owned subdomain, `dm-dashboard.vintageinterior.co.uk`, to the main `digital-marketing-member-pages` Vercel project via `vercel domains add`, with DNS configured at the registrar (IONOS) as a CNAME to Vercel's per-domain target. Confirmed live via `curl --resolve`. This is now the **permanent, primary link sent to the team** — SSL is automatic/free on Vercel regardless of domain, no certificate purchase was needed or made (explicitly clarified to the user, who had considered buying one).
   - Sent team/HR announcement messages explaining the outage in simple terms and confirming the dashboard's return.
   - **Manual Verification Required:** exact date/time of the domain-connection work is not captured in git history (no commits — pure Vercel/DNS/Search-Console actions). Placed on this date based on session continuity and the same-day GSC verification-file commit (`43eb08e`, 08:46), which is part of the same effort.

4. **Removed the now-unpublicized `.vercel.app` alias** (infra-only, no git commit): once the team moved to `dm-dashboard.vintageinterior.co.uk`, ran `vercel alias rm digital-marketing-member-pages.vercel.app` to fully remove the flagged domain from the project. Confirmed: old domain now returns 404, new domain still returns 200.

5. **Sync from Piranav** (`c6dcaff`): pulled Piranav's latest `sajeepan.html` update from `Staff-requirements`.

6. **Legacy login-popup permanent removal** (`6d5c755`): user reported (via screenshot) that Piranav's old standalone login-overlay popup (pre-dating the unified `dm_session` login system) briefly flashed on-screen on `theekshy.html` before disappearing on refresh — the overlay was still physically present in the HTML on 6 pages, only hidden by out-of-band JS unrelated to the real async auth guard. Per explicit instruction to fix "permanently" (not just hide it), the overlay HTML/JS blocks were physically deleted from `sonya.html`, `sajeepan.html`, `theekshy.html`, `thivajini.html`, `hetheesha.html`, `jakshan.html`. Same commit also fixed `eod.html`'s "Home" link, which was hardcoded to the old flagged `.vercel.app` domain instead of a relative path.

7. **Real LEDSone logo as favicon + login brand mark** (`9075c53`): replaced the generic shield SVG icon with a Google-hosted LEDSone logo image, used as both the browser-tab favicon and the login page's brand mark.
   - **Note (not yet actioned):** the logo is hotlinked from a `lh3.googleusercontent.com` URL rather than self-hosted — flagged as a risk (such URLs can expire or rate-limit) with an offer to download and self-host it made to the user; no response received, still hotlinked as of this date.

8. **`sales2.html` sidebar redesign** (`1481177`, `41794e9`): redesigned with the same navy collapsible sidebar as `thasitha.html`, applied universally (including when embedded via `?staff=` iframes in Jefri/Mahima/Sukirtha/Thasitha/Dilaksi/Kamsi's pages) per explicit user choice of "full sidebar everywhere, including inside iframes" over the recommended standalone-only option; the locked single-member `?staff=` view now hides the other member nav items/labels and the "Other Reports" section automatically. Icons initially built with emoji, then replaced with professional stroke-style SVG icons matching `thasitha.html`'s icon set, per follow-up request ("do not use emojis, use icons in a professional way").

9. **`salesuk.html`, `sales25.html`, `2025DE.html` — same sidebar redesign** (`656b445`): all three redesigned with the identical navy collapsible sidebar + SVG icon set as `sales2.html`, replacing their old `.back` link + reqtabs group-filter bar (group filters/tabs inside the page content were left untouched — only the page-level navigation changed).

10. **Sidebar set to always-expanded on the 4 sales pages** (`a396869`): per explicit follow-up request, the collapse/expand toggle was removed on `sales2.html`/`salesuk.html`/`sales25.html`/`2025DE.html` only — sidebar is now permanently full-width with no collapse button, unlike the icon-rail-by-default pattern used elsewhere in the project.

11. **`muguntha.html` Performance tab — speed optimization attempted, then fully reverted** (`2c27985`, `9260168`, `134e14a`, `c05d350`, `d911f63`): user reported Sonya's Performance tab loading very slowly (~40 sequential per-month HTTP requests at concurrency 5). Two approaches were tried and both failed in production:
    - Raised client-side request concurrency from 5 to 20 — caused a real Postgres "sorry, too many clients already" error, because `sales25.js`/`salesuk.js`/`muguntha.js` all open their own connection pool even on the static-snapshot fast path, and 20 concurrent serverless invocations exhausted the database's connection limit.
    - Built a new batched endpoint (`api/muguntha-perf-sonya.js`, since deleted) that called the same three handler modules in-process (no network round trips) — this hung indefinitely in production (30s+ with no response) rather than returning faster, for reasons not fully diagnosed before the decision was made to abandon the approach.
    - Per explicit instruction ("undo all that is not useful... we will do later"), `muguntha.html` was restored via `git checkout` to its exact pre-optimization state (commit `bce5bc2`) and the new endpoint file deleted. **The Performance tab's slowness is a confirmed, still-open problem** — no working fix was shipped this date. See Outstanding below.
    - A leftover background shell (a stale `curl`-polling loop from an earlier, unrelated deploy check) was also found still running in this session and stopped — not a code issue, just session housekeeping.

12. **Blog Tool — insert-menu "+" button flicker bug** (`6a170b0`): user reported that for some users, clicking the "+" button between blog sections shows the block-type picker menu and then immediately closes it. Root cause: `showInsertMenu()` calls `closeInsertMenu()` as its first line (by design, to close any other open menu) — the most plausible explanation for a same-click open→close flicker is a near-duplicate `click` event firing twice for one physical click (known behaviour on some trackpads/mouse drivers/remote-desktop sessions), where the second call re-enters the function and its first line closes what the first call just opened. Fixed with a 300ms debounce guard. Dedicated evidence file: `evidence/digital-marketing-member-pages/2026-08-12_blog-tool-insert-menu-double-click-flicker-fix.md`. **Manual Verification Required:** root cause could not be reproduced live in this session (static analysis only) — awaiting confirmation from an affected user that the fix resolves it.

## Files Touched
- `reports/digital-marketing-member-pages/pages/{sonya,sajeepan,theekshy,thivajini,hetheesha,jakshan}.html`
- `reports/digital-marketing-member-pages/pages/eod.html`
- `reports/digital-marketing-member-pages/pages/login.html`
- `reports/digital-marketing-member-pages/pages/{sales2,salesuk,sales25,2025DE}.html`
- `reports/digital-marketing-member-pages/pages/muguntha.html` (net no-op — reverted to pre-existing state)
- `reports/digital-marketing-member-pages/pages/blog-tool/index.html`
- `reports/digital-marketing-member-pages/googlebb3d8c1bfef3e723.html` (new)
- `C:\Users\PC\OneDrive\Desktop\eod-public\` (standalone, untracked temporary project)
- Vercel project domain configuration (`digital-marketing-member-pages`): added `dm-dashboard.vintageinterior.co.uk`, removed `digital-marketing-member-pages.vercel.app` alias — not file changes, no git history

## Status
Items 1–10 and 12 deployed to production and verified live (item 12's fix is code-verified but not yet user-confirmed live). Item 11 (Performance tab speed) is a confirmed regression-free revert — the tab works exactly as it did before today's attempt, but the original slowness complaint is still unresolved.

## Outstanding
- **Blog Tool "+" button flicker fix awaiting user confirmation** — the debounce guard is deployed and code-verified, but the original symptom wasn't reproducible live in this session, so real-world resolution isn't confirmed yet.
- **`muguntha.html` Performance tab is still slow** for Sonya (and by extension the other built members) — the concurrency-raise and batched-endpoint approaches both failed in production; needs a different fix (e.g., proper connection pooling via a pgBouncer-style proxy, or a batched endpoint that's actually debugged for why it hung). Explicitly deferred by the user ("we will do later").
- **jeffri-meta July backfill still not run** (carried over from 2026-08-11, confirmed via direct file check — see `evidence/sales/2026-08-11_hourly-snapshot-cron-stale-month-bug.md`).
- **Login page logo still hotlinked**, not self-hosted (carried over from item 7).
- **Jefri R4 real date-filter** (`77a4b8f`, `2e41d93` on 2026-08-11) — Manual Verification Required, no confirming commit found on this date either.
- **Search Console review request** for the old `.vercel.app` domain — still pending Google's response, now low priority since the team uses the custom domain.
- **Large page-file sizes** (kamsi.html ~15MB, mahima.html ~14MB, dilaksi.html ~4MB) — third part of the 2026-08-11 performance request, still not started.
