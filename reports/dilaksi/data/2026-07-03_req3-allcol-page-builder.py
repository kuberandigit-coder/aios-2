# Dilaksi Requirement 3 — ALL COLLECTIONS page builder (single source of truth)
# Merges: sitemap URL list + GA4 organic 12m + GSC 12m + Semrush backlinks + HTTP/title + nav links
# Output: dilaksi-req3-pages-for-removal.html (both copies) — rerun after refreshing any CSV.
import csv, re, html, os
from collections import defaultdict

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

GEN_DATE = "2026-07-03"
WINDOW = "2025-07-04 → 2026-07-03"

urls = [r["url"] for r in csv.DictReader(open(p("2026-07-03_req3-all-collections-sitemap.csv"), encoding="utf-8"))]
handles = [re.match(r"https://ledsone\.co\.uk/collections/([^/?]+)", u).group(1) for u in urls]

ga4t, ga4e = {}, {}
for r in csv.DictReader(open(p("2026-07-03_req3-allcol-ga4-organic-12m.csv"), encoding="utf-8")):
    ga4t[r["handle"]] = int(r["sessions_total_incl_variants"]); ga4e[r["handle"]] = int(r["sessions_exact_url"])

gsci, gscc = {}, {}
for r in csv.DictReader(open(p("2026-07-03_req3-allcol-gsc-12m.csv"), encoding="utf-8")):
    gsci[r["handle"]] = int(r["impressions_12m"]); gscc[r["handle"]] = int(r["clicks_12m"])

bl, bld = defaultdict(int), defaultdict(int)
for r in csv.DictReader(open(p("2026-07-03_req3-allcol-semrush-backlinks.csv"), encoding="utf-8")):
    bl[r["handle"]] += int(r["backlinks_num"]); bld[r["handle"]] += int(r["domains_num"])

status, titles = {}, {}
for r in csv.DictReader(open(p("2026-07-03_req3-allcol-http-titles.csv"), encoding="utf-8")):
    h = re.match(r"https://ledsone\.co\.uk/collections/([^/?]+)", r["url"]).group(1)
    status[h] = r["http_status"]; titles[h] = r["page_title"]

nav = {}
for r in csv.DictReader(open(p("2026-07-03_req3-allcol-navlinks.csv"), encoding="utf-8")):
    nav[r["handle"]] = (r["in_header"] == "True", r["in_footer"] == "True")

rows = []
for h in handles:
    rows.append({
        "handle": h, "title": titles.get(h, ""), "status": status.get(h, "?"),
        "ga4": ga4t.get(h, 0), "ga4e": ga4e.get(h, 0),
        "imp": gsci.get(h, 0), "clk": gscc.get(h, 0),
        "bl": bl.get(h, 0), "bld": bld.get(h, 0),
        "hdr": nav.get(h, (False, False))[0], "ftr": nav.get(h, (False, False))[1],
    })
rows.sort(key=lambda r: (-r["ga4"], -r["imp"]))

n_live = sum(1 for r in rows if r["status"] == "200")
n_zero = sum(1 for r in rows if r["ga4"] == 0 and r["imp"] == 0 and r["bl"] == 0)
tot_sess = sum(r["ga4"] for r in rows); tot_imp = sum(r["imp"] for r in rows)
n_linked = sum(1 for r in rows if r["hdr"] or r["ftr"])

def fmt(n): return f"{n:,}"

body_rows = []
for r in rows:
    t = html.escape(r["title"]) if r["title"] else "—"
    live_pill = ('<span class="pill yes">Yes</span><div class="why">HTTP 200</div>' if r["status"] == "200"
                 else f'<span class="pill no">No — {r["status"]}</span><div class="why">live check failed</div>')
    linked_bits = []
    linked_bits.append("Header ✓" if r["hdr"] else "Header ✗")
    linked_bits.append("Footer ✓" if r["ftr"] else "Footer ✗")
    linked = (f'<span class="pill yes">Yes</span><div class="why">{" · ".join(linked_bits)} · Sitemap ✓</div>'
              if (r["hdr"] or r["ftr"]) else
              f'<span class="pill sm">Sitemap only</span><div class="why">Header ✗ · Footer ✗ · in auto-generated sitemap</div>')
    ga4_cls = "sess" if r["ga4"] > 0 else "sess zero"
    ga4_why = (f'{fmt(r["ga4e"])} exact URL + {fmt(r["ga4"]-r["ga4e"])} on ?page/query variants'
               if r["ga4"] > r["ga4e"] else "exact URL only") if r["ga4"] > 0 else "no organic landing sessions in 12m"
    bl_cls = "sess" if r["bl"] > 0 else "sess zero"
    bl_why = f'from {r["bld"]} referring domain{"s" if r["bld"]!=1 else ""}' if r["bl"] > 0 else "not in Semrush index"
    imp_cls = "sess" if r["imp"] > 0 else "sess zero"
    imp_why = f'{fmt(r["clk"])} clicks (12m)' if r["imp"] > 0 else "0 impressions · 0 clicks"
    zero_sig = "1" if (r["ga4"] == 0 and r["imp"] == 0 and r["bl"] == 0) else "0"
    nav_state = "linked" if (r["hdr"] or r["ftr"]) else "sitemap"
    body_rows.append(f'''        <tr data-ga4="{r["ga4"]}" data-bl="{r["bl"]}" data-imp="{r["imp"]}" data-nav="{nav_state}" data-zero="{zero_sig}">
          <td class="lp"><span class="path">/collections/{r["handle"]}</span><div class="why">{t}</div></td>
          <td class="num"><span class="{ga4_cls}">{fmt(r["ga4"])}</span><div class="why">{ga4_why}</div></td>
          <td class="num"><span class="{bl_cls}">{fmt(r["bl"])}</span><div class="why">{bl_why}</div></td>
          <td>{linked}</td>
          <td>{live_pill}</td>
          <td class="num"><span class="{imp_cls}">{fmt(r["imp"])}</span><div class="why">{imp_why}</div></td>
          <td class="na">—</td>
        </tr>''')

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pages for Removal — All Collections, Last 12 Months | Dilaksi | LEDSone UK</title>
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
  .tablebox{{background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden;}}
  .tablebox .tbar{{padding:14px 20px; border-bottom:1px solid var(--line); font-size:13px; color:var(--muted); display:flex; flex-wrap:wrap; gap:12px; align-items:center;}}
  .tbar input{{flex:1; min-width:220px; padding:8px 14px; border:1px solid var(--line); border-radius:8px; font-size:13px;}}
  .tbar label{{display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#42506a;}}
  .tbar select{{padding:7px 10px; border:1px solid var(--line); border-radius:8px; font-size:12.5px; background:#fff; color:var(--ink); cursor:pointer;}}
  .scroll{{overflow-x:auto;}}
  table{{width:100%; border-collapse:collapse; font-size:13px; min-width:1180px; table-layout:fixed;}}
  col.c-url{{width:22%;}} col.c-ga4{{width:12%;}} col.c-bl{{width:12%;}} col.c-nav{{width:17%;}} col.c-live{{width:11%;}} col.c-gsc{{width:13%;}} col.c-act{{width:7%;}}
  thead th{{background:#f0f3f8; text-align:left; padding:12px 16px; font-size:11.5px; text-transform:uppercase; letter-spacing:.5px; color:#42506a; border-bottom:2px solid var(--line); cursor:pointer; user-select:none;}}
  thead th.num, td.num{{text-align:right;}}
  tbody td{{padding:12px 16px; border-bottom:1px solid var(--line); vertical-align:top; line-height:1.45;}}
  tbody tr:nth-child(even){{background:#fafbfd;}}
  tbody tr:hover{{background:var(--accent-soft);}}
  td.lp{{font-weight:600; overflow-wrap:break-word; word-break:normal;}}
  td.lp .path{{font-family:Consolas,"Courier New",monospace; font-size:12px; color:var(--accent); background:var(--accent-soft); border-radius:6px; padding:2px 8px; display:inline-block; max-width:100%; overflow-wrap:anywhere;}}
  td.na{{color:var(--na); font-style:italic;}}
  .pill{{display:inline-block; border-radius:999px; padding:3px 11px; font-size:11.5px; font-weight:700; white-space:nowrap; color:#fff;}}
  .pill.yes{{background:#2e7d32;}}
  .pill.no{{background:#c62828;}}
  .pill.sm{{background:#9aa3b2;}}
  .sess{{font-weight:700; font-size:14px;}}
  .sess.zero{{color:var(--na); font-weight:600;}}
  .why{{font-size:11px; color:var(--muted); margin-top:4px; line-height:1.5; overflow-wrap:break-word;}}
  .footnotes{{margin-top:18px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px 24px; font-size:12.5px; color:var(--muted); line-height:1.65;}}
  .footnotes h3{{font-size:13px; color:var(--ink); margin-bottom:8px;}}
  .footnotes strong{{color:var(--ink);}}
  @media (max-width:700px){{ h1{{font-size:18px;}} .card .value{{font-size:19px;}} }}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 3 — All Collections</div>
    <h1>Data Required to Identify Pages for Removal — All {len(rows)} Live Collections, Last 12 Months</h1>
    <div class="sub">Website: <strong>https://ledsone.co.uk/</strong> &nbsp;·&nbsp; Requested by: <strong>Dilaksi</strong> (SEO team) &nbsp;·&nbsp; Generated: <strong>{GEN_DATE}</strong></div>
    <div class="filters">
      <span class="chip">Reporting period: Last 12 months ({WINDOW})</span>
      <span class="chip">Sources: GA4 Data API · GSC Search Analytics API · Semrush Backlink Analytics · Shopify sitemap · Live HTTP + HTML checks</span>
      <span class="chip">Sorted by GA4 organic sessions (highest first)</span>
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="label">Live Collections</div><div class="value">{fmt(len(rows))}</div><div class="note">from the site's own sitemap</div></div>
    <div class="card"><div class="label">HTTP 200 Verified</div><div class="value">{fmt(n_live)}</div><div class="note">individually checked {GEN_DATE}</div></div>
    <div class="card"><div class="label">Organic Sessions (12m)</div><div class="value">{fmt(tot_sess)}</div><div class="note">GA4, all collections combined</div></div>
    <div class="card"><div class="label">GSC Impressions (12m)</div><div class="value">{fmt(tot_imp)}</div><div class="note">all collections combined</div></div>
    <div class="card"><div class="label">Zero-Signal Collections</div><div class="value">{fmt(n_zero)}</div><div class="note">0 sessions · 0 impressions · 0 backlinks</div></div>
    <div class="card"><div class="label">Linked in Header/Footer</div><div class="value">{fmt(n_linked)}</div><div class="note">rest are sitemap-only</div></div>
  </div>

  <div class="tablebox">
    <div class="tbar"><span id="cnt">All {len(rows)} live collection URLs</span> <span style="color:#9aa3b2">· click a column header to sort</span>
      <input type="text" id="q" placeholder="Search collection URL or title…" oninput="flt()"></div>
    <div class="tbar" style="border-top:0;">
      <label>GA4 Traffic <select id="f_ga4" onchange="flt()">
        <option value="">All</option><option value="has">Has sessions</option><option value="high">100+ sessions</option><option value="zero">Zero sessions</option></select></label>
      <label>Backlinks <select id="f_bl" onchange="flt()">
        <option value="">All</option><option value="has">Has backlinks</option><option value="zero">Zero backlinks</option></select></label>
      <label>GSC Impressions <select id="f_imp" onchange="flt()">
        <option value="">All</option><option value="has">Has impressions</option><option value="high">10,000+</option><option value="zero">Zero impressions</option></select></label>
      <label>Navigation <select id="f_nav" onchange="flt()">
        <option value="">All</option><option value="linked">Header/Footer linked</option><option value="sitemap">Sitemap only</option></select></label>
      <label>Signal <select id="f_zero" onchange="flt()">
        <option value="">All</option><option value="zero">Zero-signal (removal candidates)</option><option value="some">Has any signal</option></select></label>
      <button onclick="rst()" style="padding:7px 16px;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:pointer;font-size:12.5px;">Reset filters</button>
    </div>
    <div class="scroll">
    <table id="t">
      <colgroup>
        <col class="c-url"><col class="c-ga4"><col class="c-bl"><col class="c-nav"><col class="c-live"><col class="c-gsc"><col class="c-act">
      </colgroup>
      <thead>
        <tr>
          <th onclick="srt(0,false)">URL / Collection</th>
          <th class="num" onclick="srt(1,true)">GA4 Sessions<br>(12m, organic)</th>
          <th class="num" onclick="srt(2,true)">Referring<br>Backlinks</th>
          <th onclick="srt(3,false)">Linked in Nav /<br>Footer / Sitemap</th>
          <th onclick="srt(4,false)">Currently Live</th>
          <th class="num" onclick="srt(5,true)">GSC Impressions<br>(12m)</th>
          <th>Recommended<br>Action</th>
        </tr>
      </thead>
      <tbody>
{chr(10).join(body_rows)}
      </tbody>
    </table>
    </div>
  </div>

  <div class="footnotes">
    <h3>Notes &amp; Methodology</h3>
    <strong>Collection list:</strong> all URLs in the live site's own sitemap chain (sitemap.xml → sitemap_collections_1.xml), fetched {GEN_DATE} — this is the set of collections actually published on the online store ({len(rows)} of 383 admin collections; the rest are app/internal collections not published to the storefront).<br>
    <strong>GA4 Sessions:</strong> Google Analytics Data API (service account, property 408110563), one bulk query — organic-search landing-page sessions (sessionDefaultChannelGroup = Organic Search), 12 months ({WINDOW}). Query-string variants (?page=2 etc.) of the same collection are included and noted per row.<br>
    <strong>Referring Backlinks:</strong> Semrush Backlink Analytics (backlinks_pages report, root domain ledsone.co.uk, sorted by backlinks; the report reached 0-backlink pages, so every collection not listed genuinely has no indexed backlinks). Fetched {GEN_DATE}.<br>
    <strong>Linked in Nav/Footer/Sitemap:</strong> homepage &lt;header&gt;/&lt;footer&gt; HTML inspected {GEN_DATE}; all rows are in the (auto-generated) sitemap by definition, so "Sitemap only" marks collections with no deliberate navigation link.<br>
    <strong>Currently Live:</strong> individual HTTP request to every URL on {GEN_DATE} (throttled to respect rate limits). Page titles are taken from each live page's &lt;title&gt; tag.<br>
    <strong>Recommended Action:</strong> intentionally blank — needs a Kuberan-approved business rule before it can be filled.<br>
    <strong>Data files:</strong> <code>reports/dilaksi/data/2026-07-03_req3-allcol-*.csv</code> · Builder: <code>2026-07-03_req3-allcol-page-builder.py</code> (rerun to regenerate this page).
  </div>

</div>
<script>
function flt(){{
  var q=document.getElementById('q').value.toLowerCase();
  var fga=document.getElementById('f_ga4').value, fbl=document.getElementById('f_bl').value,
      fim=document.getElementById('f_imp').value, fnv=document.getElementById('f_nav').value,
      fz=document.getElementById('f_zero').value;
  var shown=0, total=0;
  document.querySelectorAll('#t tbody tr').forEach(function(tr){{
    total++;
    var ga4=+tr.dataset.ga4, bl=+tr.dataset.bl, imp=+tr.dataset.imp, nav=tr.dataset.nav, z=tr.dataset.zero;
    var ok = tr.cells[0].innerText.toLowerCase().indexOf(q)>-1;
    if(ok && fga){{ ok = fga==='has'? ga4>0 : fga==='high'? ga4>=100 : ga4===0; }}
    if(ok && fbl){{ ok = fbl==='has'? bl>0 : bl===0; }}
    if(ok && fim){{ ok = fim==='has'? imp>0 : fim==='high'? imp>=10000 : imp===0; }}
    if(ok && fnv){{ ok = nav===fnv; }}
    if(ok && fz){{ ok = fz==='zero'? z==='1' : z==='0'; }}
    tr.style.display = ok ? '' : 'none';
    if(ok) shown++;
  }});
  document.getElementById('cnt').textContent = shown===total ? 'All '+total+' live collection URLs' : 'Showing '+shown+' of '+total+' collections';
}}
function rst(){{
  ['f_ga4','f_bl','f_imp','f_nav','f_zero'].forEach(function(i){{document.getElementById(i).value='';}});
  document.getElementById('q').value=''; flt();
}}
var dir={{}};
function srt(i,num){{
  var tb=document.querySelector('#t tbody'), rows=[].slice.call(tb.rows);
  dir[i]=!dir[i];
  rows.sort(function(a,b){{
    var x=a.cells[i].innerText.trim(), y=b.cells[i].innerText.trim();
    if(num){{x=parseFloat(x.replace(/,/g,''))||0; y=parseFloat(y.replace(/,/g,''))||0; return dir[i]?y-x:x-y;}}
    return dir[i]?y.localeCompare(x):x.localeCompare(y);
  }});
  rows.forEach(function(r){{tb.appendChild(r);}});
}}
</script>
</body>
</html>
'''

out1 = os.path.join(DATA, "..", "..", "digital-marketing-member-pages", "pages", "dilaksi-req3-pages-for-removal.html")
out2 = os.path.join(DATA, "..", "dilaksi-requirement-3-pages-for-removal.html")
for o in (out1, out2):
    with open(os.path.abspath(o), "w", encoding="utf-8", newline="\n") as f:
        f.write(page)
    print("wrote", os.path.abspath(o))
print(f"rows={len(rows)} live200={n_live} sessions={tot_sess} impressions={tot_imp} zero-signal={n_zero} linked={n_linked}")
