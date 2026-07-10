# -*- coding: utf-8 -*-
import json, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"
OUT = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\thasitha.html"

daily = json.load(io.open(SP + r"\thasitha_fresh_clean.json", encoding="utf-8"))["rows"]

CAMPAIGNS = {
    "23765634627": {
        "name": "Pmax | Thasi |  Shoptimised | THT | NewProduct | MCV -20/04",
        "tags": "THT",
        "budget": 5.00,
    },
    "23791285134": {
        "name": "Pmax | Thasi |  Shoptimised | MT | Metal Product | MCV -27/04",
        "tags": "MT",
        "budget": 12.00,
    },
}
CAMPAIGN_IDS = list(CAMPAIGNS.keys())

MIN_DATE = min(r["date"][:10] for r in daily)
MAX_DATE = max(r["date"][:10] for r in daily)

DAY = {}
for r in daily:
    idx = CAMPAIGN_IDS.index(r["campaign_id"])
    date = r["date"][:10]
    entry = [idx, int(r["impressions"]), int(r["clicks"]), round(r["cost"], 2), round(r["conversion_value"], 4), round(r["conversions"], 4)]
    DAY.setdefault(date, []).append(entry)

campaigns_json = json.dumps([
    {"id": cid, "name": c["name"], "tags": c["tags"], "budget": c["budget"]}
    for cid, c in CAMPAIGNS.items()
], ensure_ascii=False)
day_json = json.dumps(DAY, ensure_ascii=False, separators=(",", ":"))

html_out = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thasitha — Digital Marketing Member Reports</title>
<link rel="stylesheet" href="../assets/css/style.css">
<style>
:root{{--ink:#1a2233;--muted:#5b6577;--line:#e3e7ee;--bg:#f5f7fa;--card:#fff;--accent:#1f5eff;--accent-soft:#eaf0ff;--good:#0a7d4f;--na:#9aa3b2;}}
.back{{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--muted);text-decoration:none;font-size:13px;font-weight:600;transition:all .15s;}}
.back:hover{{background:var(--accent-soft);color:var(--accent);border-color:var(--accent);}}
.t1-wrap{{max-width:1400px;margin:0 auto;font-family:"Segoe UI",system-ui,Arial,sans-serif;color:var(--ink);}}
.t1-header{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 26px;margin-bottom:16px;}}
.t1-header h1{{font-size:21px;margin-bottom:4px;}}
.t1-header .sub{{color:var(--muted);font-size:13px;}}
.t1-period{{display:inline-block;margin-top:10px;background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:5px 14px;font-size:12.5px;font-weight:600;}}
.t1-cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;}}
.t1-card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 18px;}}
.t1-card .l{{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;}}
.t1-card .v{{font-size:20px;font-weight:700;margin-top:5px;}}
.t1-filterbox{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:16px;display:flex;flex-direction:column;gap:14px;}}
.t1-row{{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;}}
.t1-field{{display:flex;flex-direction:column;gap:5px;font-size:10.5px;font-weight:700;color:#42506a;text-transform:uppercase;letter-spacing:.4px;flex:1 1 160px;min-width:140px;}}
.t1-field input, .t1-field select{{text-transform:none;letter-spacing:normal;font-weight:500;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:#fff;color:var(--ink);height:38px;}}
.t1-btn{{height:38px;padding:0 16px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);white-space:nowrap;}}
.t1-btn.primary{{background:var(--accent);color:#fff;border-color:var(--accent);}}
.t1-btn.on{{background:var(--ink);color:#fff;border-color:var(--ink);}}
.t1-legend{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:16px;font-size:12.5px;color:var(--muted);line-height:1.9;}}
.t1-legend strong{{color:var(--ink);}}
.t1-legend .lg-item{{display:inline-flex;align-items:center;gap:6px;margin-right:18px;}}
.t1-tablewrap{{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto;margin-bottom:16px;}}
table.t1-table{{width:100%;border-collapse:collapse;font-size:12.5px;min-width:1300px;}}
table.t1-table th{{text-align:left;padding:11px 12px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#42506a;border-bottom:2px solid var(--line);background:#fafbfd;white-space:nowrap;cursor:pointer;user-select:none;}}
table.t1-table th.sortable:hover{{color:var(--accent);}}
table.t1-table td{{padding:9px 12px;border-bottom:1px solid #eef1f6;vertical-align:top;white-space:nowrap;}}
table.t1-table td.wrap{{white-space:normal;max-width:260px;}}
table.t1-table td.num{{text-align:right;}}
.t1-badge{{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:4px 12px;white-space:nowrap;color:#fff;}}
.b-poor{{background:#c62828;}}
.b-average{{background:#ef6c00;}}
.b-good{{background:#1f5eff;}}
.b-hero{{background:#0a7d4f;}}
.b-check{{background:#6b7280;}}
.t1-na{{color:var(--na);font-style:italic;}}
.t1-empty{{padding:40px 20px;text-align:center;color:var(--muted);font-size:14px;}}
.t1-statusnote{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;font-size:12px;color:var(--muted);line-height:1.8;}}
.t1-statusnote strong{{color:var(--ink);}}
@media(max-width:640px){{.t1-header h1{{font-size:18px;}}.t1-card .v{{font-size:17px;}}}}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="../index.html">&larr; Back to all members</a>

<div class="t1-wrap">

<div class="t1-header">
  <div style="font-size:11px;font-weight:700;letter-spacing:.8px;color:var(--accent);text-transform:uppercase;margin-bottom:6px;">Requirement 1</div>
  <h1>Campaign Performance &amp; ROAS Action</h1>
  <div class="sub">Google Ads &middot; LEDSone DE &middot; Custom Date Range</div>
  <div class="t1-period" id="t1Period"></div>
</div>

<div class="t1-cards">
  <div class="t1-card"><div class="l">Campaign Count</div><div class="v" id="kpiCount">&ndash;</div></div>
  <div class="t1-card"><div class="l">Impressions</div><div class="v" id="kpiImpr">&ndash;</div></div>
  <div class="t1-card"><div class="l">Clicks</div><div class="v" id="kpiClicks">&ndash;</div></div>
  <div class="t1-card"><div class="l">CTR</div><div class="v" id="kpiCtr">&ndash;</div></div>
  <div class="t1-card"><div class="l">Total Cost</div><div class="v" id="kpiCost">&ndash;</div></div>
  <div class="t1-card"><div class="l">Total Conversion Value</div><div class="v" id="kpiValue">&ndash;</div></div>
  <div class="t1-card"><div class="l">Overall ROAS</div><div class="v" id="kpiRoas">&ndash;</div></div>
</div>

<div class="t1-filterbox">
  <div class="t1-row">
    <label class="t1-field">Start Date
      <input id="t1Start" type="date" min="{MIN_DATE}" max="{MAX_DATE}" value="{MIN_DATE}">
    </label>
    <label class="t1-field">End Date
      <input id="t1End" type="date" min="{MIN_DATE}" max="{MAX_DATE}" value="{MAX_DATE}">
    </label>
    <button class="t1-btn primary" id="t1Apply">Apply</button>
    <button class="t1-btn" id="t1Reset">Reset</button>
    <button class="t1-btn on" id="t1ViewAgg" data-view="agg">Aggregate View</button>
    <button class="t1-btn" id="t1ViewDaily" data-view="daily">Daily View</button>
  </div>
  <div class="t1-row">
    <label class="t1-field" style="flex:2;min-width:220px;">Search
      <input id="t1Search" type="text" placeholder="Campaign name, ID, tag, or action&hellip;">
    </label>
    <label class="t1-field">Action Filter
      <select id="t1ActionFilter">
        <option value="all">All Actions</option>
        <option value="Poor">Poor</option>
        <option value="Average">Average</option>
        <option value="Good">Good</option>
        <option value="Hero">Hero</option>
        <option value="Data Check Required">Data Check Required</option>
      </select>
    </label>
    <label class="t1-field">Sort By
      <select id="t1Sort">
        <option value="cost_desc">Cost (High &rarr; Low)</option>
        <option value="cost_asc">Cost (Low &rarr; High)</option>
        <option value="value_desc">Conversion Value (High &rarr; Low)</option>
        <option value="value_asc">Conversion Value (Low &rarr; High)</option>
        <option value="roas_desc">ROAS (High &rarr; Low)</option>
        <option value="roas_asc">ROAS (Low &rarr; High)</option>
        <option value="days_desc">Active Days (High &rarr; Low)</option>
        <option value="days_asc">Active Days (Low &rarr; High)</option>
      </select>
    </label>
  </div>
</div>

<div class="t1-legend">
  <strong>ROAS Classification</strong><br>
  <span class="lg-item"><span class="t1-badge b-poor">Poor</span> Below 200%</span>
  <span class="lg-item"><span class="t1-badge b-average">Average</span> 200% to below 350%</span>
  <span class="lg-item"><span class="t1-badge b-good">Good</span> 350% to 500%</span>
  <span class="lg-item"><span class="t1-badge b-hero">Hero</span> Above 500%</span>
  <span class="lg-item"><span class="t1-badge b-check">Data Check Required</span> ROAS not available</span>
</div>

<div class="t1-tablewrap">
<table class="t1-table" id="t1TableAgg">
<thead><tr>
  <th>Campaign Name</th><th>Campaign ID</th><th>Tags</th>
  <th class="sortable" data-sort="days">Active Days</th>
  <th class="num">Daily Budget</th>
  <th class="num">Impressions</th>
  <th class="num">Clicks</th>
  <th class="num">CTR</th>
  <th class="sortable num" data-sort="cost">Cost</th>
  <th class="sortable num" data-sort="value">Conversion Value</th>
  <th class="sortable num" data-sort="roas">ROAS</th>
  <th>Action</th>
</tr></thead>
<tbody id="t1Tbody"></tbody>
</table>
<table class="t1-table" id="t1TableDaily" style="display:none;">
<thead><tr>
  <th>Date</th><th>Campaign Name</th><th>Campaign ID</th><th>Tags</th>
  <th class="num">Impressions</th>
  <th class="num">Clicks</th>
  <th class="num">CTR</th>
  <th class="num">Cost</th>
  <th class="num">Conversion Value</th>
  <th class="num">ROAS</th>
  <th>Action</th>
</tr></thead>
<tbody id="t1TbodyDaily"></tbody>
</table>
<div class="t1-empty" id="t1Empty" style="display:none;">No campaigns found for the selected date range.</div>
</div>

<div class="t1-statusnote">
  <strong>Data source:</strong> PostgreSQL (read-only) <code>google_ads.campaign_performance</code> joined to <code>google_ads.campaigns</code>, filtered to <code>account_id = 9031058245</code> (ledsone.de) and <code>group_name = 'Thasi'</code> &mdash; the explicit internal campaign-ownership field synced from Google Ads.<br>
  <strong>Latest available data:</strong> {MAX_DATE} &middot; <strong>Full data range available:</strong> {MIN_DATE} to {MAX_DATE} &middot; <strong>Refresh status:</strong> re-pulled fresh from PostgreSQL at build time; synced hourly from Google Ads via the existing AIOS pipeline. This page is a static snapshot, not a live query.<br>
  <strong>Why numbers may differ slightly from the Google Ads UI:</strong> Google Ads revises conversion values retroactively for days/weeks after the click as attribution data is finalised (delayed and cross-device attribution). Our hourly sync captures a point-in-time snapshot &mdash; the most recent 1&ndash;7 days are the most likely to still be revised upward by Google after this page was built. Cost and Impressions/Clicks/CTR are not affected by this lag; only Conversion Value and ROAS on recent days may shift.
</div>

</div>
</div>

<script>
const CAMPAIGNS = {campaigns_json};
const DAY = {day_json};
const MIN_DATE = "{MIN_DATE}";
const MAX_DATE = "{MAX_DATE}";

function esc(s){{return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}}
function eur(v){{return '&euro;'+Number(v).toLocaleString(undefined,{{minimumFractionDigits:2,maximumFractionDigits:2}});}}
function num(v){{return Number(v).toLocaleString();}}

function daysBetween(start,end){{
  var out=[];
  var cur=new Date(start+'T00:00:00Z');
  var last=new Date(end+'T00:00:00Z');
  while(cur.getTime()<=last.getTime()){{
    out.push(cur.toISOString().slice(0,10));
    cur.setUTCDate(cur.getUTCDate()+1);
  }}
  return out;
}}

function actionFor(roas){{
  if(roas===null) return 'Data Check Required';
  if(roas<200) return 'Poor';
  if(roas<350) return 'Average';
  if(roas<=500) return 'Good';
  return 'Hero';
}}
function actionClass(a){{
  if(a==='Poor') return 'b-poor';
  if(a==='Average') return 'b-average';
  if(a==='Good') return 'b-good';
  if(a==='Hero') return 'b-hero';
  return 'b-check';
}}

function computeRange(start,end){{
  const days = daysBetween(start,end);
  const agg = CAMPAIGNS.map(()=>({{impressions:0,clicks:0,cost:0,value:0,conversions:0,activeDays:0}}));
  days.forEach(function(day){{
    const entries = DAY[day]||[];
    entries.forEach(function(e){{
      const idx=e[0];
      agg[idx].impressions += e[1];
      agg[idx].clicks += e[2];
      agg[idx].cost += e[3];
      agg[idx].value += e[4];
      agg[idx].conversions += e[5];
      agg[idx].activeDays += 1;
    }});
  }});
  return CAMPAIGNS.map(function(c,i){{
    const a = agg[i];
    const cost = Math.round(a.cost*100)/100;
    const value = Math.round(a.value*100)/100;
    const ctr = a.impressions>0 ? Math.round((a.clicks/a.impressions*100)*100)/100 : 0;
    let roas = null;
    if(cost>0) roas = Math.round((value/cost*100)*100)/100;
    const action = actionFor(roas);
    return {{
      id:c.id, name:c.name, tags:c.tags, budget:c.budget,
      activeDays:a.activeDays, impressions:a.impressions, clicks:a.clicks, ctr:ctr,
      cost:cost, value:value, roas:roas, action:action
    }};
  }});
}}

function computeDaily(start,end){{
  const days = daysBetween(start,end);
  const rows = [];
  days.forEach(function(day){{
    const entries = DAY[day]||[];
    entries.forEach(function(e){{
      const c = CAMPAIGNS[e[0]];
      const impressions=e[1], clicks=e[2], cost=Math.round(e[3]*100)/100, value=Math.round(e[4]*100)/100;
      const ctr = impressions>0 ? Math.round((clicks/impressions*100)*100)/100 : 0;
      let roas = null;
      if(cost>0) roas = Math.round((value/cost*100)*100)/100;
      rows.push({{
        date:day, id:c.id, name:c.name, tags:c.tags,
        impressions:impressions, clicks:clicks, ctr:ctr, cost:cost, value:value, roas:roas, action:actionFor(roas)
      }});
    }});
  }});
  return rows;
}}

let ROWS = computeRange(MIN_DATE, MAX_DATE);
let DAILY_ROWS = computeDaily(MIN_DATE, MAX_DATE);
let currentView = 'agg';

function render(){{
  const q = document.getElementById('t1Search').value.trim().toLowerCase();
  const af = document.getElementById('t1ActionFilter').value;
  const sort = document.getElementById('t1Sort').value;

  if(currentView==='agg'){{
    let rows = ROWS.filter(function(r){{
      const textHit = !q || r.name.toLowerCase().includes(q) || r.id.includes(q) || (r.tags||'').toLowerCase().includes(q) || r.action.toLowerCase().includes(q);
      const actionHit = af==='all' || r.action===af;
      return textHit && actionHit;
    }});
    const sortMap = {{
      cost_desc: (a,b)=>b.cost-a.cost, cost_asc: (a,b)=>a.cost-b.cost,
      value_desc: (a,b)=>b.value-a.value, value_asc: (a,b)=>a.value-b.value,
      roas_desc: (a,b)=>(b.roas??-1)-(a.roas??-1), roas_asc: (a,b)=>(a.roas??-1)-(b.roas??-1),
      days_desc: (a,b)=>b.activeDays-a.activeDays, days_asc: (a,b)=>a.activeDays-b.activeDays
    }};
    rows.sort(sortMap[sort]||sortMap.cost_desc);

    const tbody = document.getElementById('t1Tbody');
    const emptyEl = document.getElementById('t1Empty');
    document.getElementById('t1TableAgg').style.display='';
    document.getElementById('t1TableDaily').style.display='none';
    if(rows.length===0){{
      tbody.innerHTML=''; emptyEl.style.display='block';
    }} else {{
      emptyEl.style.display='none';
      tbody.innerHTML = rows.map(function(r){{
        return '<tr>'
          + '<td class="wrap">'+esc(r.name)+'</td>'
          + '<td>'+esc(r.id)+'</td>'
          + '<td>'+esc(r.tags)+'</td>'
          + '<td class="num">'+r.activeDays+'</td>'
          + '<td class="num">'+eur(r.budget)+'</td>'
          + '<td class="num">'+num(r.impressions)+'</td>'
          + '<td class="num">'+num(r.clicks)+'</td>'
          + '<td class="num">'+r.ctr.toFixed(2)+'%</td>'
          + '<td class="num">'+eur(r.cost)+'</td>'
          + '<td class="num">'+eur(r.value)+'</td>'
          + '<td class="num">'+(r.roas===null?'<span class="t1-na">N/A</span>':r.roas.toFixed(2)+'%')+'</td>'
          + '<td><span class="t1-badge '+actionClass(r.action)+'">'+esc(r.action)+'</span></td>'
          + '</tr>';
      }}).join('');
    }}

    const count = rows.length;
    const totalImpr = rows.reduce((s,r)=>s+r.impressions,0);
    const totalClicks = rows.reduce((s,r)=>s+r.clicks,0);
    const totalCost = rows.reduce((s,r)=>s+r.cost,0);
    const totalValue = rows.reduce((s,r)=>s+r.value,0);
    const overallRoas = totalCost>0 ? (totalValue/totalCost*100) : null;
    const overallCtr = totalImpr>0 ? (totalClicks/totalImpr*100) : 0;
    document.getElementById('kpiCount').textContent = count.toLocaleString();
    document.getElementById('kpiImpr').textContent = totalImpr.toLocaleString();
    document.getElementById('kpiClicks').textContent = totalClicks.toLocaleString();
    document.getElementById('kpiCtr').textContent = overallCtr.toFixed(2)+'%';
    document.getElementById('kpiCost').textContent = eur(totalCost).replace('&euro;','\\u20ac');
    document.getElementById('kpiValue').textContent = eur(totalValue).replace('&euro;','\\u20ac');
    document.getElementById('kpiRoas').textContent = overallRoas===null ? 'N/A' : overallRoas.toFixed(2)+'%';
  }} else {{
    let rows = DAILY_ROWS.filter(function(r){{
      const textHit = !q || r.name.toLowerCase().includes(q) || r.id.includes(q) || (r.tags||'').toLowerCase().includes(q) || r.action.toLowerCase().includes(q);
      const actionHit = af==='all' || r.action===af;
      return textHit && actionHit;
    }});
    rows.sort((a,b)=> a.date<b.date ? 1 : (a.date>b.date ? -1 : 0));

    const tbodyD = document.getElementById('t1TbodyDaily');
    const emptyEl = document.getElementById('t1Empty');
    document.getElementById('t1TableAgg').style.display='none';
    document.getElementById('t1TableDaily').style.display='';
    if(rows.length===0){{
      tbodyD.innerHTML=''; emptyEl.style.display='block';
    }} else {{
      emptyEl.style.display='none';
      tbodyD.innerHTML = rows.map(function(r){{
        return '<tr>'
          + '<td>'+r.date+'</td>'
          + '<td class="wrap">'+esc(r.name)+'</td>'
          + '<td>'+esc(r.id)+'</td>'
          + '<td>'+esc(r.tags)+'</td>'
          + '<td class="num">'+num(r.impressions)+'</td>'
          + '<td class="num">'+num(r.clicks)+'</td>'
          + '<td class="num">'+r.ctr.toFixed(2)+'%</td>'
          + '<td class="num">'+eur(r.cost)+'</td>'
          + '<td class="num">'+eur(r.value)+'</td>'
          + '<td class="num">'+(r.roas===null?'<span class="t1-na">N/A</span>':r.roas.toFixed(2)+'%')+'</td>'
          + '<td><span class="t1-badge '+actionClass(r.action)+'">'+esc(r.action)+'</span></td>'
          + '</tr>';
      }}).join('');
    }}

    const totalImpr = rows.reduce((s,r)=>s+r.impressions,0);
    const totalClicks = rows.reduce((s,r)=>s+r.clicks,0);
    const totalCost = rows.reduce((s,r)=>s+r.cost,0);
    const totalValue = rows.reduce((s,r)=>s+r.value,0);
    const overallRoas = totalCost>0 ? (totalValue/totalCost*100) : null;
    const overallCtr = totalImpr>0 ? (totalClicks/totalImpr*100) : 0;
    const uniqueCampaigns = new Set(rows.map(r=>r.id)).size;
    document.getElementById('kpiCount').textContent = uniqueCampaigns.toLocaleString();
    document.getElementById('kpiImpr').textContent = totalImpr.toLocaleString();
    document.getElementById('kpiClicks').textContent = totalClicks.toLocaleString();
    document.getElementById('kpiCtr').textContent = overallCtr.toFixed(2)+'%';
    document.getElementById('kpiCost').textContent = eur(totalCost).replace('&euro;','\\u20ac');
    document.getElementById('kpiValue').textContent = eur(totalValue).replace('&euro;','\\u20ac');
    document.getElementById('kpiRoas').textContent = overallRoas===null ? 'N/A' : overallRoas.toFixed(2)+'%';
  }}
}}

function applyRange(){{
  const start = document.getElementById('t1Start').value || MIN_DATE;
  const end = document.getElementById('t1End').value || MAX_DATE;
  ROWS = computeRange(start, end);
  DAILY_ROWS = computeDaily(start, end);
  document.getElementById('t1Period').textContent = 'Reporting period: '+start+' to '+end;
  render();
}}

document.getElementById('t1Apply').addEventListener('click', applyRange);
document.getElementById('t1Reset').addEventListener('click', function(){{
  document.getElementById('t1Start').value = MIN_DATE;
  document.getElementById('t1End').value = MAX_DATE;
  applyRange();
}});
document.getElementById('t1Search').addEventListener('input', render);
document.getElementById('t1ActionFilter').addEventListener('change', render);
document.getElementById('t1Sort').addEventListener('change', render);

document.getElementById('t1ViewAgg').addEventListener('click', function(){{
  currentView='agg';
  document.getElementById('t1ViewAgg').classList.add('on');
  document.getElementById('t1ViewDaily').classList.remove('on');
  render();
}});
document.getElementById('t1ViewDaily').addEventListener('click', function(){{
  currentView='daily';
  document.getElementById('t1ViewDaily').classList.add('on');
  document.getElementById('t1ViewAgg').classList.remove('on');
  render();
}});

document.querySelectorAll('table.t1-table th.sortable').forEach(function(th){{
  th.addEventListener('click', function(){{
    const key = th.getAttribute('data-sort');
    const sortSel = document.getElementById('t1Sort');
    const current = sortSel.value;
    const desc = key+'_desc', asc = key+'_asc';
    sortSel.value = (current===desc) ? asc : desc;
    render();
  }});
}});

applyRange();
</script>

  <footer class="site">Digital Marketing Member Reports &middot; AIOS &middot; generated 2026-07-10</footer>
</div>
</body>
</html>
"""

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(html_out)

print("wrote", OUT, len(html_out), "bytes")
