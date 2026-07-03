# Kamsi Requirement 2 — Low CTR Page Identification — page builder (single source of truth)
# Source: Google Search Console API (sc-domain:ledsone.co.uk), month 2026-06-01..2026-06-30
# Input CSV from 2026-07-03_kamsi_req2_gsc_fetch.py. Flag rule (verbatim): CTR (%) < 2 => Low CTR, else OK.
import csv, json, os

DATA = os.path.dirname(os.path.abspath(__file__))
GEN = "2026-07-03"
MONTH = "June 2026 (2026-06-01 → 2026-06-30)"

def p(*a): return os.path.abspath(os.path.join(*a))

rows = []
for r in csv.DictReader(open(p(DATA, "2026-07-03_kamsi_req2_gsc_pages_2026-06.csv"), encoding="utf-8")):
    u = r["page_url"]
    ptype = "Collection" if "/collections/" in u else "Blog"
    ctr = float(r["ctr_pct"])
    rows.append({
        "url": u, "path": u.replace("https://ledsone.co.uk", ""), "type": ptype,
        "kw": r["target_keyword"], "imp": int(r["impressions"]), "clk": int(r["clicks"]),
        "ctr": ctr, "pos": float(r["avg_position"]),
        "flag": "Low CTR" if ctr < 2 else "OK",
    })

rows.sort(key=lambda r: -r["imp"])

n = len(rows)
n_low = sum(1 for r in rows if r["flag"] == "Low CTR")
tot_imp = sum(r["imp"] for r in rows)
tot_clk = sum(r["clk"] for r in rows)
avg_ctr = round(tot_clk / tot_imp * 100, 2) if tot_imp else 0
n_coll = sum(1 for r in rows if r["type"] == "Collection")
n_blog = n - n_coll

def fmt(x): return f"{x:,}"

# [path, type(C/B), kw, imp, clk, ctr, pos, low(0/1)]
data_rows = [[r["path"], "C" if r["type"] == "Collection" else "B", r["kw"], r["imp"], r["clk"], r["ctr"], r["pos"], 1 if r["flag"] == "Low CTR" else 0] for r in rows]
DATA_JSON = json.dumps(data_rows, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Low CTR Page Identification | Kamsi | LEDSone UK</title>
<style>
  :root{{
    --ink:#1a2233; --muted:#5b6577; --line:#e3e7ee; --bg:#f5f7fa;
    --card:#ffffff; --accent:#1f5eff; --accent-soft:#eaf0ff;
    --na:#9aa3b2; --good:#0a7d4f; --bad:#c62828;
  }}
  *{{box-sizing:border-box; margin:0; padding:0;}}
  body{{font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif; background:var(--bg); color:var(--ink); padding:32px 20px;}}
  .wrap{{max-width:1400px; margin:0 auto;}}
  header{{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:26px 30px; margin-bottom:18px;}}
  h1{{font-size:22px; letter-spacing:.2px;}}
  .sub{{color:var(--muted); font-size:13.5px; margin-top:6px;}}
  .filters{{display:flex; flex-wrap:wrap; gap:10px; margin-top:16px;}}
  .chip{{background:var(--accent-soft); color:var(--accent); border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:600;}}
  .cards{{display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:18px;}}
  .card{{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px;}}
  .card .label{{font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.6px;}}
  .card .value{{font-size:24px; font-weight:700; margin-top:6px;}}
  .card .note{{font-size:11.5px; color:var(--muted); margin-top:4px;}}
  .card.warn .value{{color:var(--bad);}}
  .tablebox{{background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden;}}
  .tablebox .tbar{{padding:14px 20px; border-bottom:1px solid var(--line); font-size:13px; color:var(--muted); display:flex; flex-wrap:wrap; gap:12px; align-items:center;}}
  .tbar input{{flex:1; min-width:220px; padding:8px 14px; border:1px solid var(--line); border-radius:8px; font-size:13px;}}
  .tbar label{{display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#42506a;}}
  .tbar select{{padding:7px 10px; border:1px solid var(--line); border-radius:8px; font-size:12.5px; background:#fff; color:var(--ink); cursor:pointer;}}
  .tbar button{{padding:7px 16px; border:1px solid var(--line); border-radius:8px; background:#fff; cursor:pointer; font-size:12.5px;}}
  .tbar button.primary{{background:var(--accent); color:#fff; border-color:var(--accent);}}
  .scroll{{overflow-x:auto;}}
  table{{width:100%; border-collapse:collapse; font-size:13px; min-width:1100px; table-layout:fixed;}}
  col.c-url{{width:30%;}} col.c-kw{{width:16%;}} col.c-imp{{width:9%;}} col.c-clk{{width:8%;}} col.c-ctr{{width:8%;}} col.c-pos{{width:9%;}} col.c-flag{{width:9%;}}
  thead th{{background:#f0f3f8; text-align:left; padding:12px 14px; font-size:11.5px; text-transform:uppercase; letter-spacing:.5px; color:#42506a; border-bottom:2px solid var(--line); cursor:pointer; user-select:none;}}
  thead th.num, td.num{{text-align:right;}}
  tbody td{{padding:11px 14px; border-bottom:1px solid var(--line); vertical-align:top; line-height:1.45; overflow-wrap:break-word;}}
  tbody tr:nth-child(even){{background:#fafbfd;}}
  tbody tr:hover{{background:var(--accent-soft);}}
  td.lp .path{{font-family:Consolas,"Courier New",monospace; font-size:11.5px; color:var(--accent); background:var(--accent-soft); border-radius:6px; padding:2px 8px; display:inline-block; max-width:100%; overflow-wrap:anywhere; text-decoration:none;}}
  .ptype{{display:inline-block; font-size:10.5px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:#8a93a5; margin-top:4px;}}
  .pill{{display:inline-block; border-radius:999px; padding:3px 11px; font-size:11.5px; font-weight:700; white-space:nowrap; color:#fff;}}
  .pill.low{{background:#c62828;}}
  .pill.ok{{background:#2e7d32;}}
  .sess{{font-weight:700; font-size:13.5px;}}
  .sess.zero{{color:var(--na); font-weight:600;}}
  .footnotes{{margin-top:18px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px 24px; font-size:12.5px; color:var(--muted); line-height:1.65;}}
  .footnotes h3{{font-size:13px; color:var(--ink); margin-bottom:8px;}}
  .footnotes strong{{color:var(--ink);}}
  @media (max-width:700px){{ h1{{font-size:18px;}} .card .value{{font-size:19px;}} body{{padding:16px 8px;}} header{{padding:18px 16px;}} }}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Kamsi — Requirement 2</div>
    <h1>Low CTR Page Identification</h1>
    <div class="sub">Google Search Console monthly performance report for all collection and blog pages. &nbsp;·&nbsp; Website: <strong>https://ledsone.co.uk/</strong> &nbsp;·&nbsp; Requested by: <strong>Kamsi</strong> &nbsp;·&nbsp; Last updated: <strong>{GEN}</strong></div>
    <div class="filters">
      <span class="chip">Month: {MONTH} — last complete month</span>
      <span class="chip">Rule: CTR &lt; 2% → Low CTR</span>
      <span class="chip">Source: GSC Search Analytics API · property sc-domain:ledsone.co.uk · scope /collections/ + /blogs/ + /blog/</span>
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="label">Total Pages Checked</div><div class="value">{fmt(n)}</div><div class="note">{fmt(n_coll)} collections · {fmt(n_blog)} blog pages</div></div>
    <div class="card warn"><div class="label">Low CTR Pages</div><div class="value">{fmt(n_low)}</div><div class="note">CTR below 2%</div></div>
    <div class="card"><div class="label">Average CTR</div><div class="value">{avg_ctr}%</div><div class="note">clicks ÷ impressions, all pages</div></div>
    <div class="card"><div class="label">Total Impressions</div><div class="value">{fmt(tot_imp)}</div><div class="note">June 2026</div></div>
    <div class="card"><div class="label">Total Clicks</div><div class="value">{fmt(tot_clk)}</div><div class="note">June 2026</div></div>
  </div>

  <div class="tablebox">
    <div class="tbar"><span id="cnt">All {fmt(n)} pages</span>
      <input type="text" id="q" placeholder="Search URL or keyword…" oninput="flt()"></div>
    <div class="tbar" style="border-top:0;">
      <label>Flag <select id="f_flag" onchange="flt()">
        <option value="">All</option><option value="low">Low CTR</option><option value="ok">OK</option></select></label>
      <label>Page Type <select id="f_type" onchange="flt()">
        <option value="">All</option><option value="C">Collection</option><option value="B">Blog</option></select></label>
      <label>CTR Range <select id="f_ctr" onchange="flt()">
        <option value="">All</option><option value="0">0% (no clicks)</option><option value="a">0–1%</option><option value="b">1–2%</option><option value="c">2–5%</option><option value="d">5%+</option></select></label>
      <button onclick="rst()">Reset filters</button>
      <button class="primary" onclick="exp()">Export CSV</button>
    </div>
    <div class="scroll">
    <table id="t">
      <colgroup><col class="c-url"><col class="c-kw"><col class="c-imp"><col class="c-clk"><col class="c-ctr"><col class="c-pos"><col class="c-flag"></colgroup>
      <thead>
        <tr>
          <th onclick="srt(0)">Page URL</th>
          <th onclick="srt(1)">Target Keyword</th>
          <th class="num" onclick="srt(2)">Impressions</th>
          <th class="num" onclick="srt(3)">Clicks</th>
          <th class="num" onclick="srt(4)">CTR (%)</th>
          <th class="num" onclick="srt(5)">Avg Position</th>
          <th onclick="srt(6)">Flag</th>
        </tr>
      </thead>
      <tbody id="tb"></tbody>
    </table>
    </div>
    <div class="tbar" style="border-top:1px solid var(--line); border-bottom:0; justify-content:space-between;">
      <span id="pinfo"></span>
      <span style="display:flex; gap:8px; align-items:center;">
        <label>Rows <select id="psize" onchange="pg=1;render()">
          <option>50</option><option selected>100</option><option>250</option><option>500</option></select></label>
        <button onclick="pg=1;render()">&laquo;</button>
        <button onclick="if(pg>1){{pg--;render()}}">&lsaquo; Prev</button>
        <button onclick="if(pg<maxpg()){{pg++;render()}}">Next &rsaquo;</button>
        <button onclick="pg=maxpg();render()">&raquo;</button>
      </span>
    </div>
  </div>

  <div class="footnotes">
    <h3>Notes &amp; Methodology</h3>
    <strong>Source of truth:</strong> Google Search Console Search Analytics API (service account, Restricted access, property sc-domain:ledsone.co.uk), fetched {GEN}. The company PostgreSQL GSC mirror (google_search_console.gsc_web_page) was checked read-only and matches the API exactly (sample: 70 clicks / 26,370 impressions on the top blog page) — the live API remains the single source of truth for this report.<br>
    <strong>Scope:</strong> URLs containing /collections/, /blogs/ or /blog/ only ({fmt(n)} pages: {fmt(n_coll)} collections, {fmt(n_blog)} blog pages). Product pages are excluded per requirement. Only pages with at least one impression in the month appear (GSC does not report zero-impression pages).<br>
    <strong>Month:</strong> {MONTH} — the most recent complete month; no partial current-month data used.<br>
    <strong>Target Keyword:</strong> the search query with the highest impressions for that page in the month (page+query GSC data). Pages with no query rows (very low/anonymised queries) show "—".<br>
    <strong>CTR (%):</strong> page-level monthly clicks ÷ impressions × 100, rounded to 2 decimals (e.g. 0.0185 → 1.85%). <strong>Flag (verbatim rule):</strong> CTR &lt; 2% → <span class="pill low">Low CTR</span>, otherwise <span class="pill ok">OK</span>.<br>
    <strong>Avg Position:</strong> GSC average position for the page over the month, 1 decimal.<br>
    <strong>Data files:</strong> <code>reports/Kamsi/data/2026-07-03_kamsi_req2_gsc_pages_2026-06.csv</code> · Fetch: <code>2026-07-03_kamsi_req2_gsc_fetch.py</code> · Builder: <code>2026-07-03_kamsi_req2_page_builder.py</code> (rerun to regenerate).
  </div>

</div>
<script id="d" type="application/json">{DATA_JSON}</script>
<script>
var D=JSON.parse(document.getElementById('d').textContent); // [path,type,kw,imp,clk,ctr,pos,low]
var F=D.slice(), pg=1, sc=-1, sd=false;
function esc(s){{return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}}
function nfmt(n){{return n.toLocaleString('en-GB');}}
function maxpg(){{var ps=+document.getElementById('psize').value; return Math.max(1, Math.ceil(F.length/ps));}}
function ctrBucket(r){{ var c=r[5]; if(r[4]===0) return '0'; if(c<1) return 'a'; if(c<2) return 'b'; if(c<5) return 'c'; return 'd'; }}
function flt(){{
  var q=document.getElementById('q').value.toLowerCase();
  var ff=document.getElementById('f_flag').value, ft=document.getElementById('f_type').value, fc=document.getElementById('f_ctr').value;
  F=D.filter(function(r){{
    if(q && r[0].toLowerCase().indexOf(q)<0 && r[2].toLowerCase().indexOf(q)<0) return false;
    if(ff==='low' && r[7]!==1) return false;
    if(ff==='ok' && r[7]!==0) return false;
    if(ft && r[1]!==ft) return false;
    if(fc && ctrBucket(r)!==fc) return false;
    return true;
  }});
  if(sc>=0) doSort();
  pg=1; render();
}}
function rst(){{
  ['f_flag','f_type','f_ctr'].forEach(function(i){{document.getElementById(i).value='';}});
  document.getElementById('q').value=''; sc=-1; F=D.slice(); pg=1; render();
}}
function srt(i){{ sc=i; sd=!sd; doSort(); pg=1; render(); }}
function doSort(){{
  var i=sc;
  F.sort(function(a,b){{
    var r;
    if(i===2) r=a[3]-b[3];
    else if(i===3) r=a[4]-b[4];
    else if(i===4) r=a[5]-b[5];
    else if(i===5) r=a[6]-b[6];
    else if(i===6) r=a[7]-b[7];
    else if(i===1) r=String(a[2]).localeCompare(String(b[2]));
    else r=String(a[0]).localeCompare(String(b[0]));
    return sd? -r : r;
  }});
}}
function render(){{
  var ps=+document.getElementById('psize').value;
  if(pg>maxpg()) pg=maxpg();
  var s=(pg-1)*ps, rows=F.slice(s, s+ps), out=[];
  for(var i=0;i<rows.length;i++){{
    var r=rows[i];
    var flag = r[7]===1 ? '<span class="pill low">Low CTR</span>' : '<span class="pill ok">OK</span>';
    out.push('<tr><td class="lp"><a class="path" href="https://ledsone.co.uk'+esc(r[0])+'" target="_blank" rel="noopener">'+esc(r[0])+'</a><span class="ptype">'+(r[1]==='C'?'Collection':'Blog')+'</span></td>'+
      '<td>'+(r[2]?esc(r[2]):'<span style="color:#9aa3b2">&#8212;</span>')+'</td>'+
      '<td class="num"><span class="sess">'+nfmt(r[3])+'</span></td>'+
      '<td class="num"><span class="sess'+(r[4]===0?' zero':'')+'">'+nfmt(r[4])+'</span></td>'+
      '<td class="num"><span class="sess'+(r[7]===1?'':'')+'">'+r[5].toFixed(2)+'%</span></td>'+
      '<td class="num">'+r[6].toFixed(1)+'</td>'+
      '<td>'+flag+'</td></tr>');
  }}
  document.getElementById('tb').innerHTML=out.join('');
  document.getElementById('cnt').textContent = F.length===D.length ? 'All '+nfmt(D.length)+' pages' : 'Showing '+nfmt(F.length)+' of '+nfmt(D.length)+' pages';
  document.getElementById('pinfo').textContent = F.length ? ('Rows '+nfmt(s+1)+'-'+nfmt(Math.min(s+ps,F.length))+' of '+nfmt(F.length)+' | page '+pg+' / '+maxpg()) : 'No rows match';
}}
function exp(){{
  var hdr=['Page URL','Target Keyword','Impressions','Clicks','CTR (%)','Avg Position','Flag'];
  var lines=[hdr.join(',')];
  F.forEach(function(r){{
    var vals=['https://ledsone.co.uk'+r[0], r[2], r[3], r[4], r[5].toFixed(2), r[6].toFixed(1), (r[7]===1?'Low CTR':'OK')];
    lines.push(vals.map(function(v){{return '"'+String(v).replace(/"/g,'""')+'"';}}).join(','));
  }});
  var blob=new Blob([lines.join(String.fromCharCode(10))],{{type:'text/csv'}});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='kamsi-low-ctr-pages-2026-06.csv'; a.click();
}}
render();
</script>
</body>
</html>
'''

out1 = p(DATA, "..", "..", "digital-marketing-member-pages", "pages", "kamsi-req2-low-ctr-pages.html")
out2 = p(DATA, "..", "kamsi-requirement-2-low-ctr-pages.html")
for o in (out1, out2):
    with open(o, "w", encoding="utf-8", newline="\n") as f: f.write(page)
    print("wrote", o)
print(f"pages={n} low_ctr={n_low} avg_ctr={avg_ctr}% impressions={tot_imp} clicks={tot_clk} collections={n_coll} blogs={n_blog}")
