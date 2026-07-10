# -*- coding: utf-8 -*-
import json, io, html

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
OUT = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\mahima\mahima-requirement-3-search-terms-report.html"

data = json.load(io.open(SP + r"\req3_fullrange_rows.json", encoding="utf-8"))
summary = data["summary"]
rows = data["rows"]

compact = []
for r in rows:
    compact.append({
        "st": r["search_term"], "c": r["campaign"], "mt": r["match_type"],
        "imp": r["impressions"], "cl": r["clicks"], "ctr": r["ctr"],
        "cpc": r["avg_cpc"], "co": r["cost"], "cv": r["conversions"],
        "cvr": r["conv_rate"], "va": r["conv_value"], "ro": r["roas"],
        "cpco": r["cost_per_conv"], "qi": r["query_intent"],
        "nk": r["existing_negative_kw"], "ro7": r["roas_7d"],
        "ro30": r["roas_30d"], "tr": r["trend"], "pr": r["priority"], "ac": r["action"],
    })

rows_json = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))

from collections import Counter
campaign_counts = sorted(Counter(r["campaign"] for r in rows).items(), key=lambda x: -x[1])
campaign_options = "".join(
    f'<option value="{html.escape(c)}">{html.escape(c)} ({n_})</option>'
    for c, n_ in campaign_counts
)

action_counts = sorted(Counter(r["action"] for r in rows).items(), key=lambda x: -x[1])
action_options = "".join(
    f'<option value="{html.escape(a)}">{html.escape(a)} ({n_})</option>'
    for a, n_ in action_counts
)

intent_counts = sorted(Counter(r["query_intent"] for r in rows).items(), key=lambda x: -x[1])
intent_options = "".join(
    f'<option value="{html.escape(a)}">{html.escape(a)} ({n_})</option>'
    for a, n_ in intent_counts
)

priority_counts = sorted(Counter(r["priority"] for r in rows).items(), key=lambda x: -x[1])
priority_options = "".join(
    f'<option value="{html.escape(a)}">{html.escape(a)} ({n_})</option>'
    for a, n_ in priority_counts
)

html_out = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mahima - Google Ads Reports</title>
<style>
:root{{--ink:#1a2233;--muted:#5b6577;--line:#e3e7ee;--bg:#f5f7fa;--card:#fff;--accent:#1f5eff;--accent-soft:#eaf0ff;--good:#0a7d4f;--na:#9aa3b2;}}
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{font-family:"Segoe UI",system-ui,Arial,sans-serif;background:var(--bg);color:var(--ink);padding:28px 16px;}}
.wrap{{max-width:1500px;margin:0 auto;}}
.back{{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--muted);text-decoration:none;font-size:13px;font-weight:600;transition:all .15s;}}
.back:hover{{background:var(--accent-soft);color:var(--accent);border-color:var(--accent);}}
header.top{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px 28px;margin-bottom:16px;}}
h1{{font-size:22px;}}
.sub{{color:var(--muted);font-size:13.5px;margin-top:6px;}}
.chips{{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}}
.chip{{background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:5px 13px;font-size:12px;font-weight:600;}}
.chip.warn{{background:#fff4e5;color:#9a5b00;}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 18px;}}
.card .l{{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;}}
.card .v{{font-size:21px;font-weight:700;margin-top:5px;}}
.toolbar{{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}}
#q, #campsel, #actionsel, #intentsel, #prioritysel{{flex:1;min-width:170px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:#fff;}}
.pager{{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:10px 0;flex-wrap:wrap;}}
.pager .info{{font-size:12.5px;color:var(--muted);font-weight:600;}}
.tbtn{{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);}}
.legend, .limits, .sources{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);line-height:1.8;}}
.legend strong, .limits strong, .sources strong{{color:var(--ink);}}
.limits{{border-left:5px solid #ef6c00;}}
.tablewrap{{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto;margin-bottom:16px;}}
table.rt{{width:100%;border-collapse:collapse;font-size:12px;min-width:1900px;}}
table.rt th{{text-align:left;padding:9px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#42506a;border-bottom:2px solid var(--line);background:#fafbfd;white-space:nowrap;position:sticky;top:0;}}
table.rt td{{padding:7px 10px;border-bottom:1px solid #eef1f6;vertical-align:top;white-space:nowrap;}}
table.rt td.wrap-cell{{white-space:normal;max-width:220px;}}
table.rt td.num{{text-align:right;}}
tr.row-keep{{background:#f2fbf6;}}
tr.row-exclude{{background:#fdf3f3;}}
.badge{{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;padding:3px 9px;white-space:nowrap;color:#fff;}}
.b-keep{{background:#0a7d4f;}}
.b-exclude{{background:#c62828;}}
.p-high{{color:#c62828;font-weight:700;}}
.p-medium{{color:#9a6b00;font-weight:700;}}
.p-low{{color:#5b6577;font-weight:600;}}
.na{{color:var(--na);font-style:italic;}}
.foot{{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px;font-size:12.5px;color:var(--muted);line-height:1.65;}}
.foot strong{{color:var(--ink);}}
@media(max-width:600px){{h1{{font-size:18px;}}.card .v{{font-size:17px;}}}}
</style>
</head>
<body>
<div class="wrap">

<a class="back" href="../digital-marketing-member-pages/pages/mahima.html">&larr; Back to Mahima</a>

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 3 &mdash; Search Terms Report (Keep / Cut / Scale)</div>
  <h1>Mahima - Google Ads Reports</h1>
  <div class="sub">Which search terms should Mahima keep, exclude, or scale based on conversions, ROAS, query intent, and wasted spend? &middot; Account: <strong>ledsone.de</strong> (Google Ads account_id 9031058245) &middot; Date range: <strong>2026-01-01 to 2026-07-10</strong></div>
  <div class="chips">
    <span class="chip">{summary['total_terms']:,} search terms (clicks &gt; 0, full range)</span>
    <span class="chip">{summary['search_rows']:,} Search/EXACT rows with full cost data</span>
    <span class="chip warn">{summary['pmax_rows']:,} Performance Max rows &mdash; Google Ads API does not expose cost/CPC per search term for PMax (see Notes)</span>
    <span class="chip warn">No negative keywords currently configured on this account (0 of 128 keywords)</span>
  </div>
</header>

<div class="cards">
  <div class="card"><div class="l">Total Search Terms</div><div class="v">{summary['total_terms']:,}</div></div>
  <div class="card"><div class="l">Total Cost</div><div class="v">&euro;{summary['total_cost']:,.2f}</div></div>
  <div class="card"><div class="l">Total Conversion Value</div><div class="v">&euro;{summary['total_conv_value']:,.2f}</div></div>
  <div class="card"><div class="l">Overall ROAS</div><div class="v">{summary['overall_roas']}x</div></div>
  <div class="card"><div class="l">Keep Count</div><div class="v" style="color:#0a7d4f">{summary['keep_count']:,}</div></div>
  <div class="card"><div class="l">Exclude Count</div><div class="v" style="color:#c62828">{summary['exclude_count']:,}</div></div>
</div>

<div class="toolbar">
  <input id="q" type="text" placeholder="Search term or campaign&hellip;">
  <select id="campsel"><option value="all">All Campaigns</option>{campaign_options}</select>
  <select id="actionsel"><option value="all">All Recommended Actions</option>{action_options}</select>
  <select id="intentsel"><option value="all">All Query Intents</option>{intent_options}</select>
  <select id="prioritysel"><option value="all">All Priorities</option>{priority_options}</select>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage">&larr; Prev</button>
  <span class="info" id="pageInfo"></span>
  <button class="tbtn" id="nextPage">Next &rarr;</button>
</div>

<div class="tablewrap">
<table class="rt">
<thead><tr>
  <th>Search Term</th><th>Campaign</th><th>Match Type</th><th>Impressions</th><th>Clicks</th><th>CTR</th>
  <th>Avg CPC</th><th>Cost</th><th>Conversions</th><th>Conv. Rate</th><th>Conv. Value</th><th>ROAS</th>
  <th>Cost/Conv</th><th>Query Intent</th><th>Existing Neg. KW</th><th>7-Day ROAS</th><th>30-Day ROAS</th>
  <th>Trend</th><th>Priority</th><th>Recommended Action</th>
</tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>

<div class="legend">
  <strong>Recommended Action badges:</strong>
  <span class="badge b-keep">Keep</span> <span class="badge b-exclude">Exclude</span>
  &mdash; computed with the exact formula from Mahima's requirement: <em>Conversions &gt; 0 &rarr; Keep; else Competitor brand &rarr; Exclude (negative phrase); else Non-DE/mixed language &rarr; Exclude (low volume, non-native); else &rarr; Exclude (negative exact match)</em>.<br>
  <strong>Priority:</strong> <span class="p-high">High</span> / <span class="p-medium">Medium</span> / <span class="p-low">Low</span> &mdash; Exclude rows with &euro;5+ wasted cost = High priority to cut; &euro;0&ndash;5 = Medium; &euro;0 cost = Low. Keep rows with (full-range) ROAS &ge; 2x = High priority to protect/scale; below that = Medium.
</div>

<div class="sources">
  <strong>Data Sources &amp; Calculation Rules</strong><br>
  <strong>Source:</strong> PostgreSQL (read-only) <code>google_ads.campaign_search_term_data</code> joined to <code>google_ads.campaigns</code> (filtered to <code>account_id = 9031058245</code>, confirmed as ledsone.de via <code>google_ads.accounts</code>) and <code>google_ads.campaign_search_term_insights</code> for PMax category labels. Existing negative keywords checked against <code>google_ads.keywords</code> (<code>is_negative = true</code>) &mdash; none found for this account.<br>
  <strong>Date range:</strong> full range = 2026-01-01 to 2026-07-10 (all data since the campaigns' start of tracked history through today). 7-day and 30-day ROAS windows are fixed to the most recent 7/30 days from today, independent of the full-range totals shown in the main columns. Rows are search_term &times; campaign &times; match_type, restricted to rows with clicks &gt; 0 over the full range.<br>
  <strong>CTR</strong> = clicks / impressions. <strong>Avg CPC</strong> = cost / clicks. <strong>Conv. Rate</strong> = conversions / clicks. <strong>ROAS</strong> = conv. value / cost (full range). <strong>Cost/Conv</strong> = cost / conversions. <strong>7-Day / 30-Day ROAS</strong> = conv. value / cost for that fixed recent window. All divide-by-zero cases render as <span class="na">N/A</span> or 0 as specified &mdash; never fabricated.<br>
  <strong>Query Intent</strong> is a documented rule-based classifier (PostgreSQL has no query_intent column) applied to the search term text: <em>Competitor brand</em> (contains amazon/ebay/ikea/obi/hornbach/bauhaus/lampenwelt/wayfair/etc.); <em>Non-DE / mixed language</em> (English marketing phrases or ASCII-only text with no German product/diacritic markers); <em>Low-intent / bargain</em> (g&uuml;nstig/billig/gebraucht/free/cheap/discount/rabatt); <em>Generic &mdash; high</em> (contains a German lighting product word: lampe, leuchte, led, pendelleuchte, deckenlampe, trafo, fassung, etc.); else <em>Generic &mdash; medium</em>.<br>
  <strong>Trend</strong>: 7-Day ROAS &gt; 30-Day ROAS = Rising; 7-Day ROAS &lt; 30-Day ROAS = Slight dip; both 0 and conversions = 0 = Flat, no conv.; otherwise Flat.
</div>

<div class="limits">
  <strong>Known limitations</strong><br>
  1. <strong>PMax search terms have no cost/CPC data.</strong> {summary['pmax_rows']:,} of {summary['total_terms']:,} rows come from Performance Max campaigns, where Google Ads only exposes search-term-level impressions/clicks/conversions via search term insights &mdash; not cost. This is a Google Ads API restriction, not a data pipeline gap. Cost/CPC/Cost-per-Conv show as N/A for these rows; ROAS is shown as 0 because cost is unknown (not because performance is zero).<br>
  2. Query Intent is a transparent keyword-rule classifier, not Google's own semantic categorisation &mdash; it will misclassify edge cases (e.g. brand-adjacent German phrases). Treat as a first-pass triage layer, not a final decision.<br>
  3. Report is restricted to the {summary['total_terms']:,} search terms that received at least 1 click over the full 2026-01-01 to 2026-07-10 range.<br>
  4. No negative keyword lists exist yet on this account for any campaign type, so "Existing Negative KW" is "No" for every row &mdash; this has not been cross-checked against negative keyword lists / shared lists outside the <code>google_ads.keywords</code> table since none are synced.<br>
  5. This report is read-only analysis. No negative keywords, bids, or campaigns were changed in Google Ads.
</div>

<div class="foot">
  <strong>Requirement:</strong> Mahima Requirement 3 &mdash; Search Terms Report (Keep / Cut / Scale) &middot; <strong>Owner:</strong> Mahima &middot; <strong>Built by:</strong> Claude Code (AIOS) &middot; <strong>Date:</strong> 2026-07-10 &middot; <strong>Status:</strong> Updated to full 2026-01-01 to 2026-07-10 date range, read-only PostgreSQL data, no Google Ads changes made.
</div>

</div>
<script>
const ROWS={rows_json};
let filtered = ROWS.slice();
let page = 0;
const PAGE_SIZE = 100;

function esc(s){{return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}}
function money(v){{return v==null? '<span class="na">N/A</span>' : '&euro;'+Number(v).toFixed(2);}}
function pct(v){{return v==null? '<span class="na">N/A</span>' : Number(v).toFixed(2)+'%';}}
function num(v){{return v==null? '<span class="na">N/A</span>' : v;}}
function roasFmt(v){{return (v==null||v===0)? '<span class="na">0</span>' : Number(v).toFixed(2)+'x';}}

function actionBadge(a){{
  const cls = a.startsWith('Keep') ? 'b-keep' : 'b-exclude';
  return '<span class="badge '+cls+'">'+esc(a)+'</span>';
}}
function prioClass(p){{
  if(p==='High') return 'p-high';
  if(p==='Medium') return 'p-medium';
  return 'p-low';
}}

function render(){{
  const tbody = document.getElementById('tbody');
  const start = page*PAGE_SIZE;
  const pageRows = filtered.slice(start, start+PAGE_SIZE);
  tbody.innerHTML = pageRows.map(r => {{
    const rowClass = r.ac.startsWith('Keep') ? 'row-keep' : 'row-exclude';
    return '<tr class="'+rowClass+'">'
      + '<td class="wrap-cell">'+esc(r.st)+'</td>'
      + '<td class="wrap-cell">'+esc(r.c)+'</td>'
      + '<td>'+esc(r.mt)+'</td>'
      + '<td class="num">'+r.imp+'</td>'
      + '<td class="num">'+r.cl+'</td>'
      + '<td class="num">'+pct(r.ctr)+'</td>'
      + '<td class="num">'+money(r.cpc)+'</td>'
      + '<td class="num">'+money(r.co)+'</td>'
      + '<td class="num">'+r.cv+'</td>'
      + '<td class="num">'+pct(r.cvr)+'</td>'
      + '<td class="num">'+money(r.va)+'</td>'
      + '<td class="num">'+roasFmt(r.ro)+'</td>'
      + '<td class="num">'+money(r.cpco)+'</td>'
      + '<td>'+esc(r.qi)+'</td>'
      + '<td>'+esc(r.nk)+'</td>'
      + '<td class="num">'+roasFmt(r.ro7)+'</td>'
      + '<td class="num">'+roasFmt(r.ro30)+'</td>'
      + '<td>'+esc(r.tr)+'</td>'
      + '<td class="'+prioClass(r.pr)+'">'+esc(r.pr)+'</td>'
      + '<td>'+actionBadge(r.ac)+'</td>'
      + '</tr>';
  }}).join('');
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  document.getElementById('pageInfo').textContent = 'Page '+(page+1)+' of '+totalPages+' &middot; '+filtered.length+' rows';
  document.getElementById('prevPage').disabled = page<=0;
  document.getElementById('nextPage').disabled = page>=totalPages-1;
}}

function applyFilters(){{
  const q = document.getElementById('q').value.trim().toLowerCase();
  const camp = document.getElementById('campsel').value;
  const act = document.getElementById('actionsel').value;
  const intent = document.getElementById('intentsel').value;
  const prio = document.getElementById('prioritysel').value;
  filtered = ROWS.filter(r => {{
    if(camp!=='all' && r.c!==camp) return false;
    if(act!=='all' && r.ac!==act) return false;
    if(intent!=='all' && r.qi!==intent) return false;
    if(prio!=='all' && r.pr!==prio) return false;
    if(q && !(r.st.toLowerCase().includes(q) || r.c.toLowerCase().includes(q))) return false;
    return true;
  }});
  page = 0;
  render();
}}

document.getElementById('q').addEventListener('input', applyFilters);
document.getElementById('campsel').addEventListener('change', applyFilters);
document.getElementById('actionsel').addEventListener('change', applyFilters);
document.getElementById('intentsel').addEventListener('change', applyFilters);
document.getElementById('prioritysel').addEventListener('change', applyFilters);
document.getElementById('prevPage').addEventListener('click', ()=>{{ if(page>0){{page--;render();}} }});
document.getElementById('nextPage').addEventListener('click', ()=>{{ const tp=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); if(page<tp-1){{page++;render();}} }});

render();
</script>
</body>
</html>
"""

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(html_out)

print("wrote", OUT, len(html_out), "bytes")
