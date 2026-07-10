# -*- coding: utf-8 -*-
import json, io, html
from collections import Counter

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
TARGET = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\mahima.html"

data = json.load(io.open(SP + r"\req3_fullrange_rows.json", encoding="utf-8"))
summary = data["summary"]
rows = data["rows"]

def opt(counter_pairs, all_label):
    out = f'<option value="all">{all_label}</option>'
    for val, cnt in counter_pairs:
        out += f'<option value="{html.escape(val)}">{html.escape(val)} ({cnt})</option>'
    return out

camp_counts = sorted(Counter(r["campaign"] for r in rows).items(), key=lambda x: -x[1])
action_counts = sorted(Counter(r["action"] for r in rows).items(), key=lambda x: -x[1])
intent_counts = sorted(Counter(r["query_intent"] for r in rows).items(), key=lambda x: -x[1])
prio_counts = sorted(Counter(r["priority"] for r in rows).items(), key=lambda x: -x[1])

new_panel = f"""<div id="tabPanel3" class="tab-panel" style="display:none;">

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 3 &mdash; Search Terms Report (Keep / Cut / Scale)</div>
  <h1>Mahima - Search Terms Report</h1>
  <div class="sub">Which search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query intent, and wasted spend? &middot; Account: <strong>ledsone.de</strong> (Google Ads account_id 9031058245) &middot; Date Range: <strong>2026-01-01 to 2026-07-10 (full range)</strong></div>
  <div class="chips">
    <span class="chip">{summary['total_terms']:,} search terms (clicks &gt; 0, full range)</span>
    <span class="chip">{summary['search_rows']:,} Search/EXACT rows with full cost data</span>
    <span class="chip warn">{summary['pmax_rows']:,} Performance Max rows &mdash; Google Ads API does not expose cost/CPC per search term for PMax</span>
    <span class="chip warn">No negative keywords currently configured on this account (0 of 128 keywords)</span>
  </div>
</header>

<div class="cards" id="kpiCards3">
  <div class="card"><div class="l">Total Search Terms</div><div class="v">{summary['total_terms']:,}</div></div>
  <div class="card"><div class="l">Total Cost</div><div class="v">&euro;{summary['total_cost']:,.2f}</div></div>
  <div class="card"><div class="l">Total Conversion Value</div><div class="v">&euro;{summary['total_conv_value']:,.2f}</div></div>
  <div class="card"><div class="l">Overall ROAS</div><div class="v">{summary['overall_roas']}x</div></div>
  <div class="card"><div class="l">Keep Count</div><div class="v" style="color:#0a7d4f">{summary['keep_count']:,}</div></div>
  <div class="card"><div class="l">Exclude Count</div><div class="v" style="color:#c62828">{summary['exclude_count']:,}</div></div>
</div>

<div class="quickfilters" id="quickFilters3">
  <button class="qbtn on" data-action="all" onclick="quickFilter3(this,'all')">All Terms</button>
  <button class="qbtn qb-keep" data-action="Keep" onclick="quickFilter3(this,'Keep')">&#128994; Keep</button>
  <button class="qbtn qb-exclude" data-action="Exclude" onclick="quickFilter3(this,'Exclude')">&#128308; Exclude</button>
</div>

<div class="toolbar filterbar2">
  <label class="flabel">Search
    <input id="q3" type="text" placeholder="Search term or campaign&hellip;">
  </label>
  <label class="flabel">Campaign
    <select id="campsel3">{opt(camp_counts, 'All Campaigns')}</select>
  </label>
  <label class="flabel">Recommended Action
    <select id="actionsel3">{opt(action_counts, 'All Recommended Actions')}</select>
  </label>
  <label class="flabel">Query Intent
    <select id="intentsel3">{opt(intent_counts, 'All Query Intents')}</select>
  </label>
  <label class="flabel">Priority
    <select id="prioritysel3">{opt(prio_counts, 'All Priorities')}</select>
  </label>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage3">&larr; Prev</button>
  <span class="info" id="pageInfo3"></span>
  <button class="tbtn" id="nextPage3">Next &rarr;</button>
</div>

<div class="tablewrap">
<table class="rt">
<thead><tr>
  <th>Search Term</th><th>Campaign</th><th>Match Type</th><th>Impressions</th><th>Clicks</th><th>CTR</th>
  <th>Avg CPC</th><th>Cost</th><th>Conversions</th><th>Conv. Rate</th><th>Conv. Value</th><th>ROAS</th>
  <th>Cost/Conv</th><th>Query Intent</th><th>Existing Neg. KW</th><th>7-Day ROAS</th><th>30-Day ROAS</th>
  <th>Trend</th><th>Priority</th><th>Recommended Action</th>
</tr></thead>
<tbody id="tbody3"></tbody>
</table>
</div>

<div class="legend">
  <strong>Recommended Action badges:</strong>
  <span class="badge b-keep">Keep</span> <span class="badge b-exclude">Exclude</span>
  &mdash; exact formula: <em>Conversions &gt; 0 &rarr; Keep; else Competitor brand &rarr; Exclude (negative phrase); else Non-DE/mixed language &rarr; Exclude (low volume, non-native); else &rarr; Exclude (negative exact match)</em>.<br>
  <strong>Priority:</strong> <span class="p-high">High</span> / <span class="p-medium">Medium</span> / <span class="p-low">Low</span> &mdash; Exclude rows with &euro;5+ wasted cost = High; &euro;0&ndash;5 = Medium; &euro;0 cost = Low. Keep rows with full-range ROAS &ge; 2x = High; below = Medium.
</div>

<div class="sources">
  <strong>Data Sources &amp; Calculation Rules</strong><br>
  <strong>Source:</strong> PostgreSQL (read-only) <code>google_ads.campaign_search_term_data</code> joined to <code>google_ads.campaigns</code> (account_id 9031058245 = ledsone.de) and <code>google_ads.campaign_search_term_insights</code> for PMax category labels. Negative keywords checked against <code>google_ads.keywords</code> &mdash; none exist for this account.<br>
  <strong>Date range:</strong> full range = 2026-01-01 to 2026-07-10. 7-Day/30-Day ROAS are fixed to the most recent 7/30 days from today, independent of the full-range totals in the main columns.<br>
  <strong>CTR</strong>=clicks/impressions. <strong>Avg CPC</strong>=cost/clicks. <strong>Conv. Rate</strong>=conversions/clicks. <strong>ROAS</strong>=conv. value/cost (full range). <strong>Cost/Conv</strong>=cost/conversions. <strong>7-Day/30-Day ROAS</strong>=conv. value/cost for that fixed recent window. Divide-by-zero always shown as N/A or 0, never fabricated.<br>
  <strong>Query Intent</strong> is a documented rule-based classifier (no query_intent column in PostgreSQL): Competitor brand / Non-DE &amp; mixed language / Low-intent &amp; bargain / Generic &mdash; high / Generic &mdash; medium. Full rule text in <code>reports/mahima/mahima-requirement-3-search-terms-report.html</code>.<br>
  <strong>Trend</strong>: 7-Day ROAS &gt; 30-Day ROAS = Rising; &lt; = Slight dip; both 0 with 0 conversions = Flat, no conv.; otherwise Flat.
</div>

<div class="limits">
  <strong>Known limitations</strong><br>
  1. {summary['pmax_rows']:,} of {summary['total_terms']:,} rows are Performance Max search terms with no cost/CPC data &mdash; a Google Ads API restriction, not a pipeline gap.<br>
  2. Query Intent is a transparent keyword-rule classifier, not Google's own semantic categorisation.<br>
  3. Report scoped to search terms with &ge;1 click over the full 2026-01-01 to 2026-07-10 range.<br>
  4. No negative keyword lists exist yet on this account, so Existing Negative KW is "No" for every row.<br>
  5. Read-only analysis &mdash; no negative keywords, bids, or campaigns were changed in Google Ads.
</div>

</div>
"""

with io.open(TARGET, encoding="utf-8") as f:
    lines = f.readlines()

idx_open = None
idx_script = None
for i, l in enumerate(lines):
    if 'id="tabPanel3"' in l:
        idx_open = i
    if idx_open is not None and l.strip() == "<script>":
        idx_script = i
        break

assert idx_open is not None and idx_script is not None

# close div is the line right before <script>, skipping blanks
idx_close = idx_script - 1
while lines[idx_close].strip() == "":
    idx_close -= 1
assert lines[idx_close].strip() == "</div>", repr(lines[idx_close])

print("open", idx_open, "close", idx_close, "script", idx_script)

lines[idx_open:idx_close+1] = [new_panel]

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("patched tabPanel3 text block")
