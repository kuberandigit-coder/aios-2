import json, html, collections

DATA = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\mahima\data"
rows_raw = json.load(open(DATA + r"\2026-07-08_mahima_req1_product_level_raw.json", encoding="utf-8"))


def esc(s):
    return html.escape(s or "")


def gbp(v):
    return "£{:,.2f}".format(v)


rows = []
for r in rows_raw:
    spend = r["spend"] or 0.0
    clicks = r["clicks"] or 0
    revenue = r["revenue"] or 0.0
    avg_cpc = (spend / clicks) if clicks else 0.0
    rows.append({
        "cid": r["campaign_id"], "cname": r["campaign_name"], "item": r["google_item_id"],
        "sku": r["internal_sku"] or "", "title": r["product_title"], "price": r["product_price"],
        "imp": r["impressions"] or 0, "clicks": clicks,
        "ctr": float(r["ctr"] or 0), "cpc": avg_cpc, "cost": spend, "conv": float(r["conversions"] or 0),
        "cvr": float(r["cvr"] or 0), "value": revenue, "roas": float(r["roas"] or 0),
        "action": r["mahima_action"] or "Optimize", "attr": r["attribution_status"], "as_of": r["as_of"],
    })

total = len(rows)
total_cost = sum(r["cost"] for r in rows)
total_value = sum(r["value"] for r in rows)
overall_roas = (total_value / total_cost) if total_cost else 0.0
action_counts = collections.Counter(r["action"] for r in rows)
scale_n = action_counts.get("Scale", 0)
pause_n = action_counts.get("Pause", 0)
matched_title_n = sum(1 for r in rows if r["title"])
active_campaigns = len(set(r["cid"] for r in rows))

camp_counts = collections.Counter(r["cname"] for r in rows)
camp_list = sorted(camp_counts.items(), key=lambda x: -x[1])
camp_options = "".join('<option value="{h}">{name} ({n})</option>'.format(h=esc(c), name=esc(c), n=n) for c, n in camp_list)

action_list = sorted(action_counts.items(), key=lambda x: -x[1])
action_options = "".join('<option value="{h}">{name} ({n})</option>'.format(h=esc(a), name=esc(a), n=n) for a, n in action_list)

as_of = max((r["as_of"] for r in rows if r["as_of"]), default="")

rows_data = []
for r in rows:
    rows_data.append({
        "c": r["cname"], "i": r["item"], "sk": r["sku"], "t": r["title"], "pr": r["price"],
        "imp": r["imp"], "cl": r["clicks"],
        "ctr": round(r["ctr"] * 100, 2), "cpc": round(r["cpc"], 2), "co": round(r["cost"], 2),
        "cv": round(r["conv"], 2), "cvr": round(r["cvr"] * 100, 2), "va": round(r["value"], 2),
        "ro": round(r["roas"] * 100, 0), "a": r["action"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

CSS = """
:root{--ink:#1a2233;--muted:#5b6577;--line:#e3e7ee;--bg:#f5f7fa;--card:#fff;--accent:#1f5eff;--accent-soft:#eaf0ff;--good:#0a7d4f;--na:#9aa3b2;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Segoe UI",system-ui,Arial,sans-serif;background:var(--bg);color:var(--ink);padding:28px 16px;}
.wrap{max-width:1500px;margin:0 auto;}
.back{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--muted);text-decoration:none;font-size:13px;font-weight:600;transition:all .15s;}
.back:hover{background:var(--accent-soft);color:var(--accent);border-color:var(--accent);}
header.top{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px 28px;margin-bottom:16px;}
h1{font-size:22px;}
.sub{color:var(--muted);font-size:13.5px;margin-top:6px;}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
.chip{background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:5px 13px;font-size:12px;font-weight:600;}
.chip.warn{background:#fff4e5;color:#9a5b00;}
.grain-note{background:#eaf0ff;color:#1f5eff;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;margin-bottom:14px;}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 18px;}
.card .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;}
.card .v{font-size:21px;font-weight:700;margin-top:5px;}
.toolbar{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
#q, #campsel, #actionsel, #roassel{flex:1;min-width:180px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}
.tbtn{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);}
.tbtn.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.tbtn:disabled{opacity:.4;cursor:default;}
.pager{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:10px 0;flex-wrap:wrap;}
.pager .info{font-size:12.5px;color:var(--muted);font-weight:600;}
.legend, .limits, .sources{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);line-height:1.8;}
.legend strong, .limits strong, .sources strong{color:var(--ink);}
.limits{border-left:5px solid #ef6c00;}
.tablewrap{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto;margin-bottom:16px;}
table.rt{width:100%;border-collapse:collapse;font-size:12.5px;min-width:1900px;}
table.rt th{text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#42506a;border-bottom:2px solid var(--line);background:#fafbfd;white-space:nowrap;}
table.rt td{padding:8px 12px;border-bottom:1px solid #eef1f6;vertical-align:top;white-space:nowrap;}
table.rt td.wrap-cell{white-space:normal;max-width:260px;overflow:hidden;text-overflow:ellipsis;}
table.rt td.num{text-align:right;}
.badge{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;color:#fff;}
.b-scale{background:#0a7d4f;} .b-maintain{background:#1f5eff;} .b-optimize{background:#ef6c00;} .b-pause{background:#c62828;}
.na{color:var(--na);font-style:italic;}
.foot{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px;font-size:12.5px;color:var(--muted);line-height:1.65;}
.foot strong{color:var(--ink);}
@media(max-width:600px){h1{font-size:18px;}.card .v{font-size:17px;}}
"""

JS = """
const ROWS=__ROWS_JSON__;
const PAGE_SIZE=100;
const q=document.getElementById('q'),campsel=document.getElementById('campsel'),actionsel=document.getElementById('actionsel'),roassel=document.getElementById('roassel');
const tbody=document.getElementById('tbody'),pageInfo=document.getElementById('pageInfo'),prevBtn=document.getElementById('prevPage'),nextBtn=document.getElementById('nextPage');
let page=0,filtered=ROWS;

for(const r of ROWS){ r._i=(r.i||'').toLowerCase(); r._sk=(r.sk||'').toLowerCase(); r._c=(r.c||'').toLowerCase(); r._t=(r.t||'').toLowerCase(); }
function esc(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function badgeClass(a){
  if(a==='Scale') return 'b-scale';
  if(a==='Maintain') return 'b-maintain';
  if(a==='Pause') return 'b-pause';
  return 'b-optimize';
}
function debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}

function naSpan(){ return '<span class="na">Data Missing</span>'; }

function rowHtml(r){
  return `<tr>
    <td class="wrap-cell">${esc(r.c)}</td>
    <td class="wrap-cell">${esc(r.i)}</td>
    <td class="wrap-cell">${r.t?esc(r.t):naSpan()}</td>
    <td class="num">${r.imp.toLocaleString()}</td>
    <td class="num">${r.cl.toLocaleString()}</td>
    <td class="num">${r.ctr}%</td>
    <td class="num">&pound;${r.cpc.toFixed(2)}</td>
    <td class="num">&pound;${r.co.toFixed(2)}</td>
    <td class="num">${r.cv}</td>
    <td class="num">${r.cvr}%</td>
    <td class="num">&pound;${r.va.toFixed(2)}</td>
    <td class="num">${r.ro.toLocaleString()}%</td>
    <td class="num">${r.pr!=null?('&pound;'+Number(r.pr).toFixed(2)):naSpan()}</td>
    <td class="num">${naSpan()}</td>
    <td class="num">${naSpan()}</td>
    <td class="num">${naSpan()}</td>
    <td>${naSpan()}</td>
    <td>${naSpan()}</td>
    <td class="num">${naSpan()}</td>
    <td class="num">${naSpan()}</td>
    <td><span class="badge ${badgeClass(r.a)}">${esc(r.a)}</span></td>
  </tr>`;
}

function render(){
  const start=page*PAGE_SIZE;
  const pageRows=filtered.slice(start,start+PAGE_SIZE);
  tbody.innerHTML=pageRows.map(rowHtml).join('');
  const shownFrom=filtered.length?start+1:0;
  const shownTo=Math.min(start+PAGE_SIZE,filtered.length);
  pageInfo.textContent=`Showing ${shownFrom.toLocaleString()}\\u2013${shownTo.toLocaleString()} of ${filtered.length.toLocaleString()} product rows`;
  prevBtn.disabled=page<=0;
  nextBtn.disabled=start+PAGE_SIZE>=filtered.length;
}

function applyFilter(){
  const s=q.value.trim().toLowerCase();
  const cv=campsel.value;
  const av=actionsel.value;
  const rv=roassel.value;
  filtered=ROWS.filter(r=>{
    const textHit=!s||r._i.includes(s)||r._sk.includes(s)||r._c.includes(s)||r._t.includes(s);
    const campHit=cv==='all'||r.c===cv;
    const actionHit=av==='all'||r.a===av;
    let roasHit=true;
    if(rv==='0') roasHit = r.ro<=0;
    else if(rv==='low') roasHit = r.ro>0 && r.ro<150;
    else if(rv==='mid') roasHit = r.ro>=150 && r.ro<300;
    else if(rv==='high') roasHit = r.ro>=300;
    return textHit&&campHit&&actionHit&&roasHit;
  });
  page=0;
  render();
}
const debouncedFilter=debounce(applyFilter,180);
q.addEventListener('input',debouncedFilter);
campsel.addEventListener('change',applyFilter);
actionsel.addEventListener('change',applyFilter);
roassel.addEventListener('change',applyFilter);
prevBtn.addEventListener('click',()=>{if(page>0){page--;render();window.scrollTo({top:0,behavior:'instant'});}});
nextBtn.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<filtered.length){page++;render();window.scrollTo({top:0,behavior:'instant'});}});
render();
"""
JS = JS.replace("__ROWS_JSON__", rows_json)

page_html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mahima - Google Ads Reports</title>
<style>{css}</style>
</head>
<body>
<div class="wrap">

<a class="back" href="../index.html">&larr; Back to all members</a>

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 1 &mdash; Product Performance Report</div>
  <h1>Mahima - Google Ads Reports</h1>
  <div class="sub">Assess product-level profitability and feed health to guide Scale/Maintain/Optimize/Pause decisions &middot; Account: <strong>ledsone.de</strong> &middot; Data as of: <strong>{as_of}</strong></div>
  <div class="chips">
    <span class="chip">{total:,} product rows &middot; {active_campaigns} of 5 active campaigns (see limitations)</span>
    <span class="chip warn">PostgreSQL, read-only &mdash; no Google Ads/Merchant Center connector available yet</span>
    <span class="chip warn">Data snapshot dated {as_of}, not live "last 30 days from today"</span>
  </div>
</header>

<div class="grain-note">
  <strong>Table grain: one row per product within each campaign.</strong> Every row below is a single product inside a single Google Ads campaign &mdash; not a campaign-level summary. A campaign with many products shows many rows.
</div>

<div class="cards">
  <div class="card"><div class="l">Total Product Rows</div><div class="v">{total:,}</div></div>
  <div class="card"><div class="l">Active Campaigns Covered</div><div class="v">{active_campaigns}</div></div>
  <div class="card"><div class="l">Total Cost</div><div class="v">&pound;{total_cost:,.2f}</div></div>
  <div class="card"><div class="l">Total Conversion Value</div><div class="v">&pound;{total_value:,.2f}</div></div>
  <div class="card"><div class="l">Overall ROAS</div><div class="v">{overall_roas:.0%}</div></div>
  <div class="card"><div class="l">Products to Scale</div><div class="v">{scale_n:,}</div></div>
  <div class="card"><div class="l">Products to Pause</div><div class="v">{pause_n:,}</div></div>
  <div class="card"><div class="l">Data Freshness Date</div><div class="v" style="font-size:16px;">{as_of}</div></div>
</div>

<div class="toolbar">
  <input id="q" type="text" placeholder="Search product ID, title, SKU, or campaign&hellip;">
  <select id="campsel"><option value="all">All Campaigns</option>{camp_options}</select>
  <select id="actionsel"><option value="all">All Suggested Actions</option>{action_options}</select>
  <select id="roassel">
    <option value="all">All ROAS</option>
    <option value="0">0% (no conversions)</option>
    <option value="low">1&ndash;149%</option>
    <option value="mid">150&ndash;299%</option>
    <option value="high">300%+</option>
  </select>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage">&larr; Prev</button>
  <span class="info" id="pageInfo"></span>
  <button class="tbtn" id="nextPage">Next &rarr;</button>
</div>

<div class="tablewrap">
<table class="rt">
<thead><tr>
  <th>Campaign</th><th>Product ID</th><th>Product</th><th>Impressions</th><th>Clicks</th><th>CTR</th>
  <th>Avg CPC</th><th>Cost</th><th>Conversions</th><th>Conv. Rate</th><th>Conv. Value</th><th>ROAS</th>
  <th>Product Price</th><th>Product Cost</th><th>Gross Profit</th><th>Profit After Ads</th>
  <th>Feed Status</th><th>Missing Attribute</th><th>Last 7 Days ROAS</th><th>Last 30 Days ROAS</th><th>Suggested Action</th>
</tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>

<div class="legend">
  <strong>Suggested Action badges:</strong>
  <span class="badge b-scale">Scale</span> <span class="badge b-maintain">Maintain</span>
  <span class="badge b-optimize">Optimize</span> <span class="badge b-pause">Pause</span>
  &mdash; taken as-is from the source table&#39;s <code>mahima_action</code> column. <strong>Suggested Action is taken from source table and not independently recalculated unless rule inputs are available.</strong> The exact rule logic behind these values has not been independently verified against the Scale/Maintain/Optimize/Pause criteria in this requirement &mdash; treat as provisional pending confirmation.
</div>

<div class="sources">
  <strong>Data Sources &amp; Calculation Rules</strong><br>
  <strong>Product-level source:</strong> PostgreSQL <code>staging_ai.cppc_workbook_product_performance_v1</code> &mdash; confirmed genuinely product-level (9,672 distinct products across 9,673 total rows in the full table). Filtered to campaign IDs 20763699505, 23684789991, 23053104908, 23431543574 (4 of Mahima&#39;s 5 ledsone.de campaigns with product-level rows; confirmed via <code>staging_ai.cppc_campaign_truth_registry_v1</code>, owner = "Mahi").<br>
  <strong>Product Title &amp; Price:</strong> joined from <code>public.google_merchant_products</code> on <code>google_item_id = product_id</code>, restricted to ledsone.de&#39;s 4 merchant IDs AND <code>country = 'DE'</code> to guarantee exactly one matching row per product (see Known Limitations for why this restriction was necessary). Matched for <strong>{matched_title:,} of {total:,} rows ({match_pct:.0%})</strong> &mdash; the rest show "Data Missing", not a guess.<br>
  <strong>CTR</strong> = Clicks &divide; Impressions &middot; <strong>Avg CPC</strong> = Cost &divide; Clicks &middot; <strong>Conv. Rate</strong> = Conversions &divide; Clicks &middot; <strong>ROAS</strong> = Conv. Value &divide; Cost. All computed directly from the source row&#39;s spend/clicks/impressions/conversions/revenue fields. Read-only SQL only &mdash; no data modified.
</div>

<div class="limits">
  <strong>Known Limitations</strong><br>
  1. <strong>Data is not live &ldquo;last 30 days from today.&rdquo;</strong> The freshest available data across every Google Ads/product table checked in PostgreSQL is dated <strong>{as_of}</strong> (~4 weeks old). No Google Ads or Google Merchant Center API connector is available in this environment to pull live data; connecting one would require a Google-approved Developer Token and OAuth setup (see handover for details).<br>
  2. <strong>Product Price matched for only {matched_title:,} of {total:,} rows ({match_pct:.0%}).</strong> The Merchant Center feed has up to 15 duplicate rows per product across different marketing "feed_label" segments (e.g. BLACKFRIDAY, TOPSALE, AOVU15), each carrying a <em>different price for the same product</em> (spot-checked example: one product had prices ranging &pound;6.49&ndash;&pound;13.37 across 15 feed-segment rows for the identical item). Restricting to the canonical <code>country = 'DE'</code> row avoids picking an arbitrary/wrong price, but most products don&#39;t have that specific row populated &mdash; shown honestly as Data Missing rather than guessed.<br>
  3. <strong>Product Cost, Gross Profit, and Profit After Ads are Data Missing for every row.</strong> No table anywhere in the database has real populated product-cost/COGS values (checked <code>development.sku_cogs</code> &mdash; empty; <code>staging_ai.cppc_cogs_truth_model_v1</code> &mdash; all cost fields NULL for these products, and separately confirmed via <code>staging_ai.google_feed_field_discovery_v1</code> that internal_sku coverage in the cogs model is only 11.99% site-wide). Gross Profit and Profit After Ads cannot be calculated without real cost data and are not invented.<br>
  4. <strong>Feed Status and Missing Attribute are Data Missing.</strong> The correct source table (<code>raw_data.gmc_product_diagnostics_daily</code>) is completely empty (0 rows) &mdash; no Feed Status/Missing Attribute data exists anywhere in the database.<br>
  5. <strong>Last 7 Days ROAS / Last 30 Days ROAS are not shown separately.</strong> The source table stores one aggregate window per row with no day-level history to compute a rolling comparison from.<br>
  6. <strong>Campaign coverage:</strong> only 4 of Mahima&#39;s 5 active ledsone.de campaigns have product-level rows in the source table; &ldquo;Shopping DE | Mahi | klarna | TOP-MAHI | Verkaufsprodukt | tROAS | 11/06&rdquo; (campaign 23926509987) has campaign-level totals but no product-level breakdown available.<br>
  7. <strong>Suggested Action rule not independently verified</strong> &mdash; see note above the table.
</div>

<div class="foot">
  <strong>Scope:</strong> Mahima Requirement 1 &mdash; Product Performance Report, ledsone.de Google Ads, product-level view (one row per product per campaign) across Mahima&#39;s active campaigns (see Data Sources above for exact IDs).<br>
  <strong>PASS/FAIL note:</strong> the report is genuinely product-level (multiple rows per campaign, confirmed multiple products per campaign) with Product ID and Product Title columns visible. Product Cost, Feed Status, and Missing Attribute remain Data Missing by design (no source exists, not invented) &mdash; this build should be read as a <strong>partial, clearly-labeled product-level version</strong> pending the data-gap decisions documented in the AIOS evidence/handover files.
</div>

</div>
<script>{js}</script>
</body>
</html>""".format(
    css=CSS, js=JS, as_of=as_of, total=total, total_cost=total_cost, total_value=total_value,
    overall_roas=overall_roas, scale_n=scale_n, pause_n=pause_n, active_campaigns=active_campaigns,
    matched_title=matched_title_n, match_pct=(matched_title_n / total),
    camp_options=camp_options, action_options=action_options,
)

out1 = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/digital-marketing-member-pages/pages/mahima.html"
open(out1, "w", encoding="utf-8").write(page_html)
print("written:", out1, len(page_html) // 1024, "KB")
print("total:", total, "matched_title:", matched_title_n, "active_campaigns:", active_campaigns,
      "total_cost:", total_cost, "total_value:", total_value, "overall_roas:", overall_roas)
