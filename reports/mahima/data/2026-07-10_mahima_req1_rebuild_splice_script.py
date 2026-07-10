# -*- coding: utf-8 -*-
import json, io, html
from collections import Counter

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
TARGET = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\mahima.html"

data = json.load(io.open(SP + r"\req1_new_rows.json", encoding="utf-8"))
summary = data["summary"]
rows = data["rows"]

compact = []
for r in rows:
    compact.append({
        "c": r["campaign"], "id": r["item_id"], "p": r["product"],
        "cl": r["clicks"], "imp": r["impressions"], "cv": r["conversions"],
        "co": r["cost"], "va": r["conv_value"], "ro": r["roas"],
        "st": r["status"], "ma": r["missing_attribute"],
    })
rows1_json = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))

camp_counts = sorted(Counter(r["campaign"] for r in rows).items(), key=lambda x: -x[1])
camp_options = "".join(
    f'<option value="{html.escape(c)}">{html.escape(c)} ({n})</option>' for c, n in camp_counts
)

title_match_pct = round(100 * (summary["total_rows"] - summary["products_missing_title"]) / summary["total_rows"], 1)

panel_html = f"""<div id="tabPanel1" class="tab-panel">

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 1 &mdash; Product Performance Report (Rebuilt)</div>
  <h1>Mahima - Google Ads Reports</h1>
  <div class="sub">Product-level performance across Mahima&#39;s active Google Ads campaigns &middot; Account: <strong>ledsone.de</strong> (account_id 9031058245) &middot; Date Range: <strong>Last 30 Days</strong></div>
  <div class="chips">
    <span class="chip">{summary['total_rows']:,} product rows &middot; {summary['distinct_campaigns']} campaigns</span>
    <span class="chip">Source: PostgreSQL (read-only) <code>google_ads.product_performance</code></span>
    <span class="chip warn">Status &amp; Missing Attribute: Not Available in PostgreSQL (see Limitations)</span>
  </div>
</header>

<div class="grain-note">
  <strong>Table grain: one row per product within each campaign.</strong> Every row below is a single product inside a single Google Ads campaign &mdash; not a campaign-level summary.
</div>

<div class="cards">
  <div class="card"><div class="l">Total Product Rows</div><div class="v">{summary['total_rows']:,}</div></div>
  <div class="card"><div class="l">Campaigns Covered</div><div class="v">{summary['distinct_campaigns']}</div></div>
  <div class="card"><div class="l">Total Clicks</div><div class="v">{summary['total_clicks']:,}</div></div>
  <div class="card"><div class="l">Total Cost</div><div class="v">&euro;{summary['total_cost']:,.2f}</div></div>
  <div class="card"><div class="l">Total Conversion Value</div><div class="v">&euro;{summary['total_conv_value']:,.2f}</div></div>
  <div class="card"><div class="l">Overall ROAS</div><div class="v">{summary['overall_roas']}x</div></div>
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
  <th>Status</th><th>Missing Attribute</th>
</tr></thead>
<tbody id="tbody1"></tbody>
</table>
</div>

<div class="sources">
  <strong>Data Sources &amp; Calculation Rules</strong><br>
  <strong>Performance:</strong> PostgreSQL (read-only) <code>google_ads.product_performance</code>, filtered to Mahima&#39;s 5 active ledsone.de campaigns (campaign_id 20763699505, 23684789991, 23053104908, 23431543574, 23926509987, confirmed via <code>google_ads.campaigns</code> where <code>account_id = 9031058245</code>), summed per product per campaign over the <strong>last 30 days</strong>.<br>
  <strong>Product title:</strong> joined from <code>google_ads.merchant_products</code> by matching the numeric product-id segment of <code>merchant_products.product_id</code> (format <code>shopify_&lt;COUNTRY&gt;_&lt;PRODUCT_ID&gt;_&lt;VARIANT_ID&gt;</code>) against <code>product_performance.product_item_id</code>, preferring the DE-country / EUR-currency feed row when multiple currency/feed-label duplicates exist for the same product. Matched for <strong>{summary['total_rows'] - summary['products_missing_title']:,} of {summary['total_rows']:,} rows ({title_match_pct}%)</strong> &mdash; unmatched rows show "Data Missing" in the Product column, not a guess.<br>
  <strong>Clicks / Impressions / Conversions / Cost / Conversion Value</strong> are direct sums from <code>google_ads.product_performance</code>. <strong>ROAS</strong> = Conversion Value &divide; Cost, shown as 0 when cost is 0 (never divided by zero).<br>
  <strong>Status</strong> and <strong>Missing Attribute</strong>: no source exists in PostgreSQL for Google Merchant Center product diagnostics (destination/approval status, item-level issues). Shown honestly as <strong>"Not Available in PostgreSQL"</strong> for every row, not fabricated or proxied.
</div>

<div class="limits">
  <strong>Known Limitations</strong><br>
  1. <strong>Status and Missing Attribute are Not Available in PostgreSQL for all {summary['total_rows']:,} rows.</strong> Re-verified 2026-07-10: the intended destination table <code>raw_data.gmc_product_diagnostics_daily</code> no longer even exists in the database (previously confirmed empty on 2026-07-09, now confirmed absent entirely). This data can only come from the Google Merchant Center Content API (<code>productstatuses</code> resource) or the Google Ads UI directly &mdash; no PostgreSQL source exists. A data request for this pipeline is open and unresolved: see <code>reports/mahima/2026-07-09_postgres_developer_request_feed_status_missing_attribute.md</code>. This version deliberately shows the honest "Not Available in PostgreSQL" label instead of the heuristic proxy used in the previous build (which risked being misread as real Google Ads status).<br>
  2. <strong>Product title matched for {title_match_pct}% of rows</strong> ({summary['total_rows'] - summary['products_missing_title']:,} of {summary['total_rows']:,}). The Merchant Center feed carries the same product under many currency/feed-label variants (seen up to 15+ duplicate rows per product); rows with no matching feed entry for the DE/EUR presentation preferred by this report show "Data Missing" rather than an arbitrary title from a different currency feed.<br>
  3. <strong>Date range is the last 30 days as of build time</strong> (2026-07-10), not a fixed historical window like the prior build. Re-running this report on a different day will produce different totals by design.<br>
  4. This report is read-only analysis. No PostgreSQL data, Google Ads campaigns, bids, or Merchant Center feeds were modified.
</div>

<div class="foot">
  <strong>Scope:</strong> Mahima Requirement 1 &mdash; Product Performance Report (fully rebuilt from scratch, 2026-07-10) &middot; ledsone.de Google Ads &middot; product-level view (one row per product per campaign) across Mahima&#39;s 5 active campaigns, last 30 days.<br>
  <strong>Validated against:</strong> Campaign "Pmax DE | Mahi | Shoptimised|  BESTEN-BELEUCHTUNG | priceGT10_5 | MCV" &times; Product 8278561882377 &rarr; 1,399 impressions, 22 clicks, &euro;14.13 cost, 0 conversions, &euro;0.00 conversion value, 0x ROAS, Status/Missing Attribute = Not Available in PostgreSQL. Cross-checked directly against raw SQL sums (see validation doc).<br>
  <strong>PASS/FAIL note:</strong> Old Requirement 1 implementation (HTML/CSS/JS/data/proxy-status logic) fully removed and replaced. Product-level grain preserved, all fields sourced from live PostgreSQL queries, no fabricated values &mdash; unavailable fields honestly labeled.
</div>

</div>
"""

js_block = f"""
function esc(s){{return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}}
function debounce(fn,ms){{let t;return function(...a){{clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);}};}}
function naSpan(){{ return '<span class="na">Data Missing</span>'; }}

const ROWS1={rows1_json};
const PAGE_SIZE1=100;
let page1=0, filtered1=ROWS1, F1=ROWS1;
for(const r of ROWS1){{ r._id=(r.id||'').toLowerCase(); r._p=(r.p||'').toLowerCase(); r._c=(r.c||'').toLowerCase(); }}

function moneyOrNA1(v){{return v==null? '<span class="na">N/A</span>' : '&euro;'+Number(v).toFixed(2);}}
function roasFmt1(v){{return (v==null||v===0)? '<span class="na">0</span>' : Number(v).toFixed(2)+'x';}}

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
    + '<td><span class="na">'+esc(r.st)+'</span></td>'
    + '<td><span class="na">'+esc(r.ma)+'</span></td>'
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

const debouncedFilter1=debounce(applyFilter1,180);
document.getElementById('q1').addEventListener('input',debouncedFilter1);
document.getElementById('campsel1').addEventListener('change',applyFilter1);
document.getElementById('roassel1').addEventListener('change',applyFilter1);
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

idx_tabpanel1_open = find_line(lambda l: 'id="tabPanel1"' in l)
idx_tabpanel2_open = find_line(lambda l: 'id="tabPanel2"' in l)
idx_rows_line = find_line(lambda l: l.startswith("const ROWS="))
idx_day_line = find_line(lambda l: l.startswith("const DAY="))
idx_pagesize_line = find_line(lambda l: l.strip() == "const PAGE_SIZE=100;")
idx_render_call = find_line(lambda l: l.strip() == "render();", start=idx_pagesize_line)

assert idx_tabpanel1_open is not None
assert idx_tabpanel2_open is not None
assert idx_rows_line is not None
assert idx_day_line == idx_rows_line + 1, f"DAY not immediately after ROWS: {{idx_day_line}} vs {{idx_rows_line}}"
assert idx_pagesize_line is not None
assert idx_render_call is not None

# tabPanel1 closing div = line right before tabPanel2 open (skip blank lines)
idx_tabpanel1_close = idx_tabpanel2_open - 1
while lines[idx_tabpanel1_close].strip() == "":
    idx_tabpanel1_close -= 1
assert lines[idx_tabpanel1_close].strip() == "</div>", f"unexpected: {{lines[idx_tabpanel1_close]!r}}"

print("tabpanel1_open", idx_tabpanel1_open)
print("tabpanel1_close", idx_tabpanel1_close)
print("tabpanel2_open", idx_tabpanel2_open)
print("rows_line", idx_rows_line)
print("day_line", idx_day_line)
print("pagesize_line", idx_pagesize_line, repr(lines[idx_pagesize_line]))
print("render_call_line", idx_render_call, repr(lines[idx_render_call]))

# --- Apply edits bottom-to-top to keep earlier indices valid ---

# 1. Replace old tab1 script block: from idx_pagesize_line through idx_render_call (inclusive) with js_block
lines[idx_pagesize_line:idx_render_call+1] = [js_block]

# 2. Replace ROWS + DAY lines with nothing (data now lives in js_block above; remove old lines)
lines[idx_rows_line:idx_day_line+1] = []

# 3. Replace tabPanel1 content (open line through close line inclusive) with new panel_html
lines[idx_tabpanel1_open:idx_tabpanel1_close+1] = [panel_html]

with io.open(TARGET, "w", encoding="utf-8") as f:
    f.writelines(lines)

print("DONE. New line count:", len(lines))
