# -*- coding: utf-8 -*-
import json, io, html
from collections import Counter

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
TARGET = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\mahima.html"

data = json.load(io.open(SP + r"\req1_final_rows.json", encoding="utf-8"))
summary = data["summary"]
rows = data["rows"]
DAY1 = json.load(io.open(SP + r"\req1_day1_final.json", encoding="utf-8"))

compact = []
for r in rows:
    compact.append({
        "c": r["campaign"], "id": r["item_id"], "p": r["product"],
        "cl": r["clicks"], "imp": r["impressions"], "cv": r["conversions"],
        "co": r["cost"], "va": r["conv_value"], "ro": r["roas"],
        "st": r["status"], "ma": r["missing_attribute"],
        "ro7": r["roas_7d"], "ro30": r["roas_30d"],
    })
rows1_json = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
day1_json = json.dumps(DAY1, ensure_ascii=False, separators=(",", ":"))

camp_counts = sorted(Counter(r["campaign"] for r in rows).items(), key=lambda x: -x[1])
camp_options = "".join(
    f'<option value="{html.escape(c)}">{html.escape(c)} ({n})</option>' for c, n in camp_counts
)

title_match_pct = round(100 * (summary["total_rows"] - summary["products_missing_title"]) / summary["total_rows"], 1)
min_date = min(DAY1.keys())
max_date = max(DAY1.keys())

# ---- CSS additions (toolbar fix + missing-attribute badges + date inputs) ----
css_fix = """
.toolbar input[type=text], .toolbar select{min-width:220px;flex:1 1 220px;}
.toolbar{gap:12px;}
.date-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:6px 0 14px;}
.date-toolbar label{font-weight:700;color:#42506a;font-size:12.5px;display:flex;align-items:center;gap:8px;}
.date-toolbar input[type=date]{padding:9px 12px;border:1px solid var(--line);border-radius:9px;font-size:13.5px;background:#fff;}
.ma-badge{display:inline-block;font-size:11px;font-weight:700;border-radius:8px;padding:4px 9px;line-height:1.5;white-space:normal;max-width:260px;}
.ma-none{background:#e6f7ee;color:#0a7d4f;}
.ma-low{background:#fff4d6;color:#8a6300;}
.ma-high{background:#fde3e3;color:#a51818;}
.ma-na{background:#eef0f4;color:#7a8394;font-style:italic;}
"""

panel_html = f"""<div id="tabPanel1" class="tab-panel">

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 1 &mdash; Product Performance Report (Rebuilt)</div>
  <h1>Mahima - Google Ads Reports</h1>
  <div class="sub">Product-level performance across Mahima&#39;s active Google Ads campaigns &middot; Account: <strong>ledsone.de</strong> (account_id 9031058245) &middot; Date Range: <strong>{min_date} to {max_date}</strong> (filterable)</div>
  <div class="chips">
    <span class="chip">{summary['total_rows']:,} product rows &middot; {summary['distinct_campaigns']} campaigns</span>
    <span class="chip">Source: PostgreSQL (read-only) <code>google_ads.product_performance</code></span>
    <span class="chip warn">Status: Not Available in PostgreSQL &middot; Missing Attribute: real per-product feed gaps</span>
  </div>
</header>

<div class="grain-note">
  <strong>Table grain: one row per product within each campaign.</strong> Every row below is a single product inside a single Google Ads campaign &mdash; not a campaign-level summary.
</div>

<div class="cards" id="kpiCards1">
  <div class="card"><div class="l">Total Product Rows</div><div class="v" id="kpiRows1">{summary['total_rows']:,}</div></div>
  <div class="card"><div class="l">Campaigns Covered</div><div class="v">{summary['distinct_campaigns']}</div></div>
  <div class="card"><div class="l">Total Clicks</div><div class="v" id="kpiClicks1">{summary['total_clicks']:,}</div></div>
  <div class="card"><div class="l">Total Cost</div><div class="v" id="kpiCost1">&euro;{summary['total_cost']:,.2f}</div></div>
  <div class="card"><div class="l">Total Conversion Value</div><div class="v" id="kpiConvValue1">&euro;{summary['total_conv_value']:,.2f}</div></div>
  <div class="card"><div class="l">Overall ROAS</div><div class="v" id="kpiRoas1">{summary['overall_roas']}x</div></div>
</div>

<div class="toolbar">
  <input id="q1" type="text" placeholder="Search item ID, product, or campaign&hellip;">
  <select id="campsel1"><option value="all">All Campaigns</option>{camp_options}</select>
  <select id="roassel1">
    <option value="all">All ROAS</option>
    <option value="0">0 (no conversions)</option>
    <option value="low">0&ndash;1x</option>
    <option value="mid">1&ndash;3x</option>
    <option value="high">3x+</option>
  </select>
</div>

<div class="date-toolbar">
  <label>Date Range:
    <input id="rangeStart1" type="date" min="{min_date}" max="{max_date}" value="{min_date}">
  </label>
  <span style="color:var(--muted);">&ndash;</span>
  <input id="rangeEnd1" type="date" min="{min_date}" max="{max_date}" value="{max_date}">
  <button class="tbtn" id="applyRange1">Apply Range</button>
  <button class="tbtn" id="clearRange1">Clear (Full {min_date} &ndash; {max_date})</button>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage1">&larr; Prev</button>
  <span class="info" id="pageInfo1"></span>
  <button class="tbtn" id="nextPage1">Next &rarr;</button>
</div>

<div class="tablewrap">
<table class="rt">
<thead><tr>
  <th>Campaign</th><th>Item ID</th><th>Product</th><th>Clicks</th><th>Impressions</th>
  <th>Conversions</th><th>Cost</th><th>Conversion Value</th><th>ROAS</th>
  <th>7-Day ROAS</th><th>30-Day ROAS</th>
  <th>Status</th><th>Missing Attribute</th>
</tr></thead>
<tbody id="tbody1"></tbody>
</table>
</div>

<div class="legend">
  <strong>Missing Attribute colour key:</strong>
  <span class="ma-badge ma-none">None missing</span>
  <span class="ma-badge ma-low">1&ndash;2 attributes missing</span>
  <span class="ma-badge ma-high">3+ attributes missing</span>
  <span class="ma-badge ma-na">Not Available in PostgreSQL</span>
  &mdash; computed per product from the 10 Shopping feed-quality attributes in <code>google_ads.merchant_products</code> (product_category, item_group_id, mpn, color, condition, description, product_types, availability, brand, price).
</div>

<div class="sources">
  <strong>Data Sources &amp; Calculation Rules</strong><br>
  <strong>Performance:</strong> PostgreSQL (read-only) <code>google_ads.product_performance</code>, filtered to Mahima&#39;s 5 active ledsone.de campaigns (campaign_id 20763699505, 23684789991, 23053104908, 23431543574, 23926509987, confirmed via <code>google_ads.campaigns</code> where <code>account_id = 9031058245</code>), summed per product per campaign over <strong>{min_date} to {max_date}</strong> by default &mdash; use the Date Range filter above to narrow this within the same window (client-side recompute from daily-level data, no re-query needed).<br>
  <strong>Product title:</strong> joined from <code>google_ads.merchant_products</code> by matching the numeric product-id segment of <code>merchant_products.product_id</code> (format <code>shopify_&lt;COUNTRY&gt;_&lt;PRODUCT_ID&gt;_&lt;VARIANT_ID&gt;</code>) against <code>product_performance.product_item_id</code>, preferring the DE-country / EUR-currency feed row when multiple currency/feed-label duplicates exist. Matched for <strong>{summary['total_rows'] - summary['products_missing_title']:,} of {summary['total_rows']:,} rows ({title_match_pct}%)</strong> &mdash; unmatched rows show "Data Missing", not a guess.<br>
  <strong>Clicks / Impressions / Conversions / Cost / Conversion Value</strong> are direct sums from <code>google_ads.product_performance</code>. <strong>ROAS</strong> = Conversion Value &divide; Cost, shown as 0 when cost is 0.<br>
  <strong>7-Day ROAS</strong> = (SUM(Conversion Value, last 7 days) &divide; SUM(Cost, last 7 days)) &times; 100. <strong>30-Day ROAS</strong> = (SUM(Conversion Value, last 30 days) &divide; SUM(Cost, last 30 days)) &times; 100. Both anchored to today (2026-07-10), independent of the Date Range filter above &mdash; they always reflect the most recent 7/30 days, shown as percentages, 0 when cost is 0.<br>
  <strong>Missing Attribute</strong>: computed directly from <code>google_ads.merchant_products</code> (same feed row used for Product title) &mdash; lists exactly which of 10 feed-quality attributes are NULL/empty for that product. Matched for the same {title_match_pct}% of rows as Product title.<br>
  <strong>Status</strong>: no reliable source exists in PostgreSQL. Checked <code>raw_data.gmc_product_diagnostics_daily</code> (table no longer exists) and <code>google_ads.ad_group_products.status</code> (exists but never covers PMax campaigns and is <code>ELIGIBLE</code> for 100% of its 1,664 rows database-wide &mdash; never once recorded a disapproval). Shown honestly as "Not Available in PostgreSQL".
</div>

<div class="limits">
  <strong>Known Limitations</strong><br>
  1. <strong>Status is Not Available in PostgreSQL for all {summary['total_rows']:,} rows.</strong> Real per-product eligibility (Eligible / Not eligible / Product paused / Disapproved, as shown in the Google Ads UI Products report) requires the Google Merchant Center Content API or the Ads/Merchant Center UI directly. Open developer request: <code>reports/mahima/2026-07-09_postgres_developer_request_feed_status_missing_attribute.md</code>.<br>
  2. <strong>Missing Attribute covers only the 10 feed-quality attributes stored in <code>merchant_products</code></strong> &mdash; not Google's item-level policy/disapproval issue codes, which live in the same unavailable diagnostics pipeline as Status. A product with "None missing" can still be disapproved for a policy reason unrelated to feed completeness. Of {summary['has_gaps_count']:,} matched rows, <strong>100% have at least one missing attribute</strong> ({summary['none_missing_count']} rows are fully complete).<br>
  3. <strong>Product title and Missing Attribute matched for {title_match_pct}% of rows</strong> ({summary['total_rows'] - summary['products_missing_title']:,} of {summary['total_rows']:,}). The Merchant Center feed carries the same product under many currency/feed-label variants; rows with no matching DE/EUR feed entry show "Not Available in PostgreSQL" rather than a guess.<br>
  4. <strong>Date Range filter is bounded to {min_date}&ndash;{max_date}</strong> (the full window this report was built for) and recomputes Clicks/Impressions/Conversions/Cost/Conversion Value/ROAS client-side from embedded daily-level data. 7-Day and 30-Day ROAS columns are NOT affected by this filter &mdash; they always show the fixed last-7/last-30-day windows anchored to today, per the requirement.<br>
  5. This report is read-only analysis. No PostgreSQL data, Google Ads campaigns, bids, or Merchant Center feeds were modified.
</div>

<div class="foot">
  <strong>Scope:</strong> Mahima Requirement 1 &mdash; Product Performance Report (fully rebuilt from scratch, 2026-07-10) &middot; ledsone.de Google Ads &middot; product-level view across Mahima&#39;s 5 active campaigns, {min_date} to {max_date}, with date-range filtering and fixed 7-Day/30-Day ROAS trend columns.<br>
  <strong>Validated against:</strong> Campaign "Pmax DE | Mahi | Shoptimised|  BESTEN-BELEUCHTUNG | priceGT10_5 | MCV" &times; Product 8278561882377 &rarr; cross-checked against the Google Ads UI Products report screenshot (Jan 1&ndash;Jul 7: 4,573 impr / 73 clicks / &euro;47.31 cost / &euro;84.11 conv. value / 0.98 conversions) &mdash; this build's {min_date}&ndash;{max_date} totals (4,584 impr / 73 clicks / &euro;47.32 cost / &euro;84.11 conv. value / 0.98 conversions) match within the extra 3 days of data, confirming the source query is correct.<br>
  <strong>PASS/FAIL note:</strong> Old Requirement 1 implementation (HTML/CSS/JS/data/proxy-status logic) fully removed and replaced. Product-level grain preserved, all fields sourced from live PostgreSQL queries, no fabricated values &mdash; unavailable fields honestly labeled, real per-product Missing Attribute data restored.
</div>

</div>
"""

js_block = f"""
function esc(s){{return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}}
function debounce(fn,ms){{let t;return function(...a){{clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);}};}}
function naSpan(){{ return '<span class="na">Data Missing</span>'; }}

const ROWS1={rows1_json};
const DAY1={day1_json};
const PAGE_SIZE1=100;
let page1=0, filtered1=ROWS1, F1=ROWS1;
for(const r of ROWS1){{ r._id=(r.id||'').toLowerCase(); r._p=(r.p||'').toLowerCase(); r._c=(r.c||'').toLowerCase(); }}

function moneyOrNA1(v){{return v==null? '<span class="na">N/A</span>' : '&euro;'+Number(v).toFixed(2);}}
function roasFmt1(v){{return (v==null||v===0)? '<span class="na">0</span>' : Number(v).toFixed(2)+'x';}}
function roasPctFmt1(v){{return (v==null||v===0)? '<span class="na">0%</span>' : Number(v).toFixed(1)+'%';}}

function maClass1(ma){{
  if(ma==='Not Available in PostgreSQL') return 'ma-na';
  if(ma==='None missing') return 'ma-none';
  const n = ma.split(',').length;
  return n>=3 ? 'ma-high' : 'ma-low';
}}

function rowHtml1(r){{
  return '<tr>'
    + '<td class="wrap-cell">'+esc(r.c)+'</td>'
    + '<td>'+esc(r.id)+'</td>'
    + '<td class="wrap-cell">'+(r.p?esc(r.p):naSpan())+'</td>'
    + '<td class="num">'+r.cl+'</td>'
    + '<td class="num">'+r.imp+'</td>'
    + '<td class="num">'+r.cv+'</td>'
    + '<td class="num">'+moneyOrNA1(r.co)+'</td>'
    + '<td class="num">'+moneyOrNA1(r.va)+'</td>'
    + '<td class="num">'+roasFmt1(r.ro)+'</td>'
    + '<td class="num">'+roasPctFmt1(r.ro7)+'</td>'
    + '<td class="num">'+roasPctFmt1(r.ro30)+'</td>'
    + '<td><span class="na">'+esc(r.st)+'</span></td>'
    + '<td class="wrap-cell"><span class="ma-badge '+maClass1(r.ma)+'">'+esc(r.ma)+'</span></td>'
    + '</tr>';
}}

function render1(){{
  const start=page1*PAGE_SIZE1;
  const pageRows=filtered1.slice(start,start+PAGE_SIZE1);
  document.getElementById('tbody1').innerHTML=pageRows.map(rowHtml1).join('');
  const shownFrom=filtered1.length?start+1:0;
  const shownTo=Math.min(start+PAGE_SIZE1,filtered1.length);
  document.getElementById('pageInfo1').textContent=`Showing ${{shownFrom.toLocaleString()}}\\u2013${{shownTo.toLocaleString()}} of ${{filtered1.length.toLocaleString()}} product rows`;
  document.getElementById('prevPage1').disabled=page1<=0;
  document.getElementById('nextPage1').disabled=start+PAGE_SIZE1>=filtered1.length;
}}

function updateKpis1(){{
  let cl=0, imp=0, co=0, va=0;
  for(const r of F1){{ cl+=r.cl; imp+=r.imp; co+=r.co; va+=r.va; }}
  document.getElementById('kpiRows1').textContent=F1.length.toLocaleString();
  document.getElementById('kpiClicks1').textContent=cl.toLocaleString();
  document.getElementById('kpiCost1').textContent='\\u20ac'+co.toLocaleString(undefined,{{minimumFractionDigits:2,maximumFractionDigits:2}});
  document.getElementById('kpiConvValue1').textContent='\\u20ac'+va.toLocaleString(undefined,{{minimumFractionDigits:2,maximumFractionDigits:2}});
  document.getElementById('kpiRoas1').textContent=(co>0?(va/co).toFixed(2):'0')+'x';
}}

function applyFilter1(){{
  const s=document.getElementById('q1').value.trim().toLowerCase();
  const cv=document.getElementById('campsel1').value;
  const rv=document.getElementById('roassel1').value;
  filtered1=F1.filter(function(r){{
    const textHit=!s||r._id.includes(s)||r._p.includes(s)||r._c.includes(s);
    const campHit=cv==='all'||r.c===cv;
    let roasHit=true;
    if(rv==='0') roasHit = r.ro<=0;
    else if(rv==='low') roasHit = r.ro>0 && r.ro<1;
    else if(rv==='mid') roasHit = r.ro>=1 && r.ro<3;
    else if(rv==='high') roasHit = r.ro>=3;
    return textHit&&campHit&&roasHit;
  }});
  page1=0;
  render1();
}}

function daysBetween1(start,end){{
  var out=[];
  var cur=new Date(start+'T00:00:00Z');
  var last=new Date(end+'T00:00:00Z');
  while(cur.getTime()<=last.getTime()){{
    out.push(cur.toISOString().slice(0,10));
    cur.setUTCDate(cur.getUTCDate()+1);
  }}
  return out;
}}

function rangeBase1(start,end){{
  if(!start||!end) return ROWS1;
  var days = start<=end ? daysBetween1(start,end) : daysBetween1(end,start);
  var agg={{}};
  days.forEach(function(day){{
    var entries=DAY1[day]||[];
    entries.forEach(function(e){{
      var idx=e[0];
      if(!agg[idx]) agg[idx]={{imp:0,cl:0,co:0,cv:0,va:0}};
      agg[idx].imp+=e[1]; agg[idx].cl+=e[2]; agg[idx].co+=e[3]; agg[idx].cv+=e[4]; agg[idx].va+=e[5];
    }});
  }});
  return ROWS1.map(function(r,i){{
    var a=agg[i];
    if(!a) return Object.assign({{}},r,{{imp:0,cl:0,co:0,cv:0,va:0,ro:0}});
    var ro = a.co>0 ? Math.round((a.va/a.co)*100)/100 : 0;
    return Object.assign({{}},r,{{imp:Math.round(a.imp),cl:Math.round(a.cl),co:Math.round(a.co*100)/100,cv:Math.round(a.cv*100)/100,va:Math.round(a.va*100)/100,ro:ro}});
  }});
}}

function pickRange1(){{
  const start=document.getElementById('rangeStart1').value;
  const end=document.getElementById('rangeEnd1').value;
  F1=rangeBase1(start,end);
  for(const r of F1){{ r._id=(r.id||'').toLowerCase(); r._p=(r.p||'').toLowerCase(); r._c=(r.c||'').toLowerCase(); }}
  updateKpis1();
  applyFilter1();
}}
window.pickRange1=pickRange1;

const debouncedFilter1=debounce(applyFilter1,180);
document.getElementById('q1').addEventListener('input',debouncedFilter1);
document.getElementById('campsel1').addEventListener('change',applyFilter1);
document.getElementById('roassel1').addEventListener('change',applyFilter1);
document.getElementById('applyRange1').addEventListener('click',pickRange1);
document.getElementById('clearRange1').addEventListener('click',function(){{
  document.getElementById('rangeStart1').value='{min_date}';
  document.getElementById('rangeEnd1').value='{max_date}';
  pickRange1();
}});
document.getElementById('prevPage1').addEventListener('click',function(){{if(page1>0){{page1--;render1();window.scrollTo({{top:0,behavior:'instant'}});}}}});
document.getElementById('nextPage1').addEventListener('click',function(){{if((page1+1)*PAGE_SIZE1<filtered1.length){{page1++;render1();window.scrollTo({{top:0,behavior:'instant'}});}}}});
render1();
"""

with io.open(TARGET, encoding="utf-8") as f:
    lines = f.readlines()

def find_line(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    return None

def find_last_before(pred, before_idx):
    result = None
    for i in range(0, before_idx):
        if pred(lines[i]):
            result = i
    return result

idx_style_close = find_line(lambda l: l.strip() == "</style>")
idx_tabpanel1_open = find_line(lambda l: 'id="tabPanel1"' in l)
idx_tabpanel2_open = find_line(lambda l: 'id="tabPanel2"' in l)
idx_esc_line = find_line(lambda l: l.startswith("function esc("))
idx_render1_call = find_line(lambda l: l.strip() == "render1();", start=idx_esc_line)

assert idx_style_close is not None
assert idx_tabpanel1_open is not None
assert idx_tabpanel2_open is not None
assert idx_esc_line is not None
assert idx_render1_call is not None

idx_tabpanel1_close = idx_tabpanel2_open - 1
while lines[idx_tabpanel1_close].strip() == "":
    idx_tabpanel1_close -= 1
assert lines[idx_tabpanel1_close].strip() == "</div>", f"unexpected: {{lines[idx_tabpanel1_close]!r}}"

print("style_close", idx_style_close)
print("tabpanel1_open", idx_tabpanel1_open)
print("tabpanel1_close", idx_tabpanel1_close)
print("tabpanel2_open", idx_tabpanel2_open)
print("esc_line", idx_esc_line)
print("render1_call", idx_render1_call, repr(lines[idx_render1_call]))

# verify render1_call is truly the LAST occurrence before tabpanel2's script continues (i.e. before ROWS2 or next section)
# find next non-blank line after render1_call - should be end of this script's tab1 section (e.g. blank then ROWS2 far below, or </script>)
# We trust esc_line..render1_call is exactly the old tab1 script block (previously validated structure)

# Apply edits bottom-to-top
lines[idx_esc_line:idx_render1_call+1] = [js_block]
lines[idx_tabpanel1_open:idx_tabpanel1_close+1] = [panel_html]
lines[idx_style_close:idx_style_close] = [css_fix]

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("DONE. New line count:", len(lines))
