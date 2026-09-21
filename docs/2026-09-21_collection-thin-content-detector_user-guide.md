# Collection Page Thin-Content Detector — User Guide

**Page location:** DM Dashboard → Development Tasks → Collection Page Thin-Content Detector
**Purpose:** Find LEDSone UK collection pages with thin content or missing FAQs, see which ones matter most based on real search traffic, and build a to-do list (backlog) for the content team.

---

## 1. Before you start: set the two thresholds (one-time setup)

Go to the **Config** tab. You'll see two cards:

| Setting | What it means |
|---|---|
| **Minimum Word Count** | How many words a collection description needs to NOT be flagged as "thin". |
| **High Traffic Threshold (GSC Clicks, 30 days)** | How many real Google clicks in 30 days makes a collection "high traffic". |

Type a number in each box and click **Save/Update**. A green **"Configured"** badge confirms it's saved.

> Currently set to: **300 words** and **10 clicks**. Change these any time — the next audit will use the new numbers.

---

## 2. Run the audit

Click the green **"Refresh Audit"** button (top right, next to the search bar). This pulls live data from Shopify and Google Search Console and re-checks every collection.

- Takes about **20–30 seconds** for all ~490 collections.
- The button shows "Auditing…" while it runs.
- Also runs automatically every **15 days** on its own — you don't have to remember to click it. (You can check/manage this in **Dev → Sync Monitor → "Dev — Collection Thin-Content Detector"**.)

---

## 3. How to read the tabs

The tab bar shows a live count next to each tab so you know how many rows are inside before you click in.

| Tab | What it's for |
|---|---|
| **Collections** | Full list — every collection, one row each. Use this to look up or search a specific collection. |
| **Priority Analysis** | ⭐ **Your main work list.** Only shows collections that need attention (skips the ones that are fine), sorted High → Medium → Low. |
| **FAQ Analysis** | Only collections with **no FAQ at all** (neither FAQ text nor FAQ schema). |
| **Traffic Analysis** | Reference view — see the real GSC clicks/impressions/CTR/position behind each priority call. |
| **Content Backlog** | ⭐ **Where you record decisions.** Same flagged list as Priority Analysis, but with a status dropdown you can change directly. |
| **Config** | The two thresholds from Step 1. |

---

## 4. Recommended workflow

**Step 1 — Open "Priority Analysis".**
Rows are sorted so the most urgent collections are at the top:

- 🔴 **HIGH** = thin content on a collection that already gets good search traffic → fix this first, it's losing you the most.
- 🟠 **MEDIUM** = thin content but lower traffic → fix when you get to it.
- 🔵 **LOW** = content is fine, just missing an FAQ.
- ⚪ **NOT CONFIGURED** = thresholds aren't set yet (see Step 1).

**Step 2 — Click "View" on a row** to open the detail panel. It shows:
- Collection URL (click to open the live page)
- Word count vs. the minimum threshold
- Whether FAQ content and/or FAQ schema exist (checked separately)
- GSC clicks, impressions, CTR, average position
- The exact reason it was flagged (e.g. *"Thin content on high-traffic collection."*)

**Step 3 — Decide, then go to "Content Backlog".**
Find the same collection and use the **status dropdown** to mark where it stands:

| Status | Meaning |
|---|---|
| **New** | Just flagged, not looked at yet (default). |
| **Review Required** | You've looked at it, needs more discussion/checking. |
| **Approved** | Confirmed — content team should rewrite this. |
| **Rejected** | Flagged but you've decided no action is needed. |

This status is **just a tracking label** — changing it does **not** touch Shopify or publish anything. It's purely to help the team know what's been decided.

**Step 4 — Content team does the actual rewrite manually in Shopify**, using the collection URL and word-count/FAQ gap shown in the detail panel as their brief.

---

## 5. Filters (top of every list tab)

- **Search box** — matches by collection title, URL, or handle. You can paste a full URL.
- **Priority** — HIGH / MEDIUM / LOW / NO ACTION / NOT CONFIGURED
- **FAQ Status** — FAQ content / FAQ schema / neither
- **Content Status** — below threshold / meets threshold / unknown
- **Traffic Level** — High / Low / Unknown

Filters apply across all tabs at once and the tab counts update live as you filter.

---

## 6. What this tool does NOT do (by design)

- ❌ Does not write or publish anything to Shopify — read-only, always.
- ❌ Does not generate content, FAQs, or briefs automatically (that's a future "Level 2" feature, not built yet).
- ❌ Does not show a live preview of the collection page.
- ✅ It only audits, prioritizes, and tracks a backlog — the actual content writing stays a manual, human step.

---

## 7. If something looks wrong

- **"Not Configured" showing everywhere** → you haven't set both thresholds yet, or haven't clicked "Refresh Audit" since setting them.
- **Numbers look stale** → click "Refresh Audit", or check "Last updated" timestamp next to the button.
- **Audit seems stuck** → check **Dev → Sync Monitor → Dev — Collection Thin-Content Detector** for run status/errors.
