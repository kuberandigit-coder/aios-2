import json, html, os, collections

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

rows = json.load(open(p("2026-07-07_req2-allcol-rows.json")))
rows.sort(key=lambda r: -r["sales"])

def esc(s):
    return html.escape(s or "")

coll_counts = collections.Counter()
for r in rows:
    for c in r["collections"]:
        coll_counts[c] += 1
coll_list = sorted(coll_counts.items(), key=lambda x: -x[1])

total_sales = sum(r["sales"] for r in rows)
total_demand = sum(r["demand"] for r in rows if r["demand"])
total_organic = sum(r["organic"] for r in rows)
pri_counts = collections.Counter(r["priority"] for r in rows)
high_n = pri_counts.get("High", 0)
med_n = pri_counts.get("Medium", 0)
low_n = pri_counts.get("Low", 0)
flag_n = pri_counts.get("Low — flag for review", 0)

coll_options = "".join(
    '<option value="{h}">{name} ({n})</option>'.format(h=esc(c), name=esc(c), n=n)
    for c, n in coll_list)
coll_datalist_options = "".join(
    '<option value="{h}">{name} ({n} products)</option>'.format(h=esc(c), name=esc(c), n=n)
    for c, n in coll_list)

# ---- Compact row data embedded as JSON — rendered client-side, paginated ----
rows_data = []
for r in rows:
    rows_data.append({
        "t": r["title"], "st": r["status"], "c": r["collections"], "sk": [s for s in r["skus"] if s],
        "nv": r["n_variants"], "s": round(r["sales"], 2), "u": r["units"],
        "d": r["demand"], "k": r["keyword"], "o": r["organic"], "p": r["priority"], "cond": r["condition"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

CSS = """
:root{--ink:#1a2233;--muted:#5b6577;--line:#e3e7ee;--bg:#f5f7fa;--card:#fff;--accent:#1f5eff;--accent-soft:#eaf0ff;--good:#0a7d4f;--na:#9aa3b2;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Segoe UI",system-ui,Arial,sans-serif;background:var(--bg);color:var(--ink);padding:28px 16px;}
.wrap{max-width:1400px;margin:0 auto;}
header.top{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px 28px;margin-bottom:16px;}
h1{font-size:22px;}
.sub{color:var(--muted);font-size:13.5px;margin-top:6px;}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
.chip{background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:5px 13px;font-size:12px;font-weight:600;}
.chip.warn{background:#fff4e5;color:#9a5b00;}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 18px;}
.card .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;}
.card .v{font-size:21px;font-weight:700;margin-top:5px;}
.toolbar{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
#q, #collq, #collsel{flex:1;min-width:220px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}
.tbtn{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);}
.tbtn.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.tbtn:disabled{opacity:.4;cursor:default;}
.pager{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:10px 0;flex-wrap:wrap;}
.pager .info{font-size:12.5px;color:var(--muted);font-weight:600;}
details.prod{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:6px;overflow:hidden;}
details.prod summary{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:11px 16px;cursor:pointer;list-style:none;flex-wrap:wrap;}
details.prod summary::-webkit-details-marker{display:none;}
details.prod summary:hover{background:var(--accent-soft);}
details.prod .t{font-size:13.5px;font-weight:600;flex:1;min-width:220px;}
.colls{display:block;margin-top:4px;}
.cb{font-size:10px;font-weight:600;color:var(--muted);background:#f0f3f8;border-radius:999px;padding:2px 8px;margin-right:4px;display:inline-block;margin-top:3px;}
.cb.more{color:var(--accent);}
.s{font-weight:700;font-size:13.5px;white-space:nowrap;}
.s.pos{color:var(--good);} .s.zero{color:var(--na);font-weight:500;}
.u{font-size:11.5px;color:var(--muted);background:#f0f3f8;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.u.none{color:var(--na);}
.dm{font-size:11.5px;font-weight:700;color:#6a1b9a;background:#f3e8fb;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.dm.dm0{color:#9aa3b2;background:#f0f3f8;font-weight:600;}
.og{font-size:11.5px;font-weight:700;color:#1f5eff;background:#eaf0ff;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.og.og0{color:#9aa3b2;background:#f0f3f8;font-weight:600;}
.dm .kw{font-weight:500;font-style:normal;opacity:.85;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom;}
.pri{font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;color:#fff;}
.pri-h{background:#d32f2f;} .pri-m{background:#ef6c00;} .pri-l{background:#2e7d32;} .pri-f{background:#7b1fa2;}
.rulenote{background:var(--card);border:1px solid var(--line);border-left:5px solid #c62828;border-radius:12px;padding:12px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);}
.rulenote strong{color:var(--ink);}
.legend{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);line-height:1.9;}
.legend strong{color:var(--ink);}
.tgroup{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.tgroup .glbl{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-right:2px;}
.st{font-size:10.5px;color:#9a5b00;background:#fff4e5;border-radius:999px;padding:2px 8px;margin-left:8px;font-weight:700;}
.vt{padding:10px 16px;font-size:12px;color:var(--muted);background:#fafbfd;border-top:1px solid var(--line);}
.foot{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px;font-size:12.5px;color:var(--muted);line-height:1.65;}
.foot strong{color:var(--ink);}
.hidden{display:none!important;}
.back{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:8px 14px;border:1px solid var(--line,#e3e7ee);border-radius:9px;background:var(--card,#fff);color:var(--muted,#5b6577);text-decoration:none;font-size:13px;font-weight:600;transition:all .15s;}
.back:hover{background:var(--accent-soft,#eaf0ff);color:var(--accent,#1f5eff);border-color:var(--accent,#1f5eff);}
.tab-nav{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px;background:var(--card,#fff);border:1px solid var(--line,#e3e7ee);border-radius:14px;padding:8px;}
.tab-btn{border:none;background:transparent;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted,#5b6577);transition:background .15s,color .15s;white-space:nowrap;text-decoration:none;display:inline-block;text-align:center;font-family:inherit;}
.tab-btn:hover{background:var(--accent-soft,#eaf0ff);color:var(--accent,#1f5eff);}
.tab-btn.active{background:var(--accent,#1f5eff);color:#fff;}
.tab-btn .tab-label{display:block;font-size:11px;font-weight:400;margin-top:1px;opacity:.8;}
@media(max-width:700px){.tab-btn{padding:7px 12px;font-size:12px;}}
@media(max-width:600px){h1{font-size:18px;}.card .v{font-size:17px;}}
"""

JS = """
const ROWS=__ROWS_JSON__;
const PAGE_SIZE=100;
const q=document.getElementById('q'),collsel=document.getElementById('collsel'),collq=document.getElementById('collq'),openB=document.getElementById('f-open');
const container=document.getElementById('rowsContainer'),pageInfo=document.getElementById('pageInfo'),pageInfo2=document.getElementById('pageInfo2'),prevBtn=document.getElementById('prevPage'),nextBtn=document.getElementById('nextPage');
let salesMode='all',priMode='all',page=0,filtered=ROWS;

// Precompute lowercase search fields once per row (not on every keystroke).
for(const r of ROWS){
  r._n=r.t.toLowerCase();
  r._sk=r.sk.join(' ').toLowerCase();
  r._c=' '+r.c.join(' ').toLowerCase()+' ';
  r._sold=r.s>0;
}

function esc(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gbp(n){return n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});}
function num(n){return n.toLocaleString('en-GB');}
function priKey(p){return p==='High'?'high':(p==='Medium'?'medium':(p.indexOf('flag')>-1?'flag':'low'));}

function rowHtml(r){
  let badge='';
  if(r.d!=null){
    const dcls=r.d>0?'dm':'dm dm0';
    badge+=`<span class="${dcls}" title="Google searches per month in the UK for the keyword mapped to this product (Semrush UK database)">Demand: ${num(r.d)} searches/mo <i class="kw">&ldquo;${esc(r.k)}&rdquo;</i></span>`;
  } else {
    badge+='<span class="dm dm0" title="no keyword could be derived from this product title">Demand: n/a</span>';
  }
  const ocls=r.o>0?'og':'og og0';
  badge+=`<span class="${ocls}" title="GA4 organic-search landing sessions, last 30 days">Organic: ${num(r.o)} visit${r.o===1?'':'s'} (30d)</span>`;
  const pcls=r.p==='High'?'pri-h':(r.p==='Medium'?'pri-m':(r.p.indexOf('flag')>-1?'pri-f':'pri-l'));
  badge+=`<span class="pri ${pcls}" title="SEO Priority — approved 6-condition rule, matched condition ${esc(r.cond)}. Demand ${r.d==null?'n/a':num(r.d)}, sales &pound;${gbp(r.s)}, organic ${r.o}, profit margin N/A (COGS pending; not required)">SEO: ${esc(r.p)}</span>`;
  badge+=`<span class="s ${r.s>0?'pos':'zero'}" title="Net sales, last 30 days (returns deducted)">&pound;${gbp(r.s)}</span>`;
  badge+= r.u ? `<span class="u">${r.u} units</span>` : '<span class="u none">no sales</span>';
  const status = r.st==='ACTIVE' ? '' : `<span class="st">${esc(r.st)}</span>`;
  let collBadges=r.c.slice(0,6).map(c=>`<span class="cb">${esc(c)}</span>`).join(' ');
  if(r.c.length>6) collBadges+=` <span class="cb more">+${r.c.length-6} more</span>`;
  const skulist=esc(r.sk.join(', '))||'&mdash;';
  return `<details class="prod"><summary><span class="t">${esc(r.t)}${status}<br><span class="colls">${collBadges}</span></span>${badge}</summary>`+
    `<div class="vt"><strong>SKUs:</strong> ${skulist} &middot; <strong>Variants:</strong> ${r.nv} &middot; <strong>Collections (${r.c.length}):</strong> ${esc(r.c.join(', '))}</div></details>`;
}

function render(){
  const start=page*PAGE_SIZE;
  const pageRows=filtered.slice(start,start+PAGE_SIZE);
  container.innerHTML=pageRows.map(rowHtml).join('');
  const shownFrom=filtered.length?start+1:0;
  const shownTo=Math.min(start+PAGE_SIZE,filtered.length);
  const infoText=`Showing ${num(shownFrom)}–${num(shownTo)} of ${num(filtered.length)} products`;
  pageInfo.textContent=infoText;
  if(pageInfo2)pageInfo2.textContent=infoText;
  prevBtn.disabled=page<=0;
  nextBtn.disabled=start+PAGE_SIZE>=filtered.length;
}

function debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}

function applyFilter(){
  const s=q.value.trim().toLowerCase();
  const cv=collsel.value.toLowerCase();
  const cq=collq.value.trim().toLowerCase();
  filtered=ROWS.filter(r=>{
    const textHit=!s||r._n.includes(s)||r._sk.includes(s);
    const salesHit=salesMode==='all'||(salesMode==='sold'?r._sold:!r._sold);
    const priHit=priMode==='all'||priKey(r.p)===priMode;
    const collHit=cv==='all'||r._c.includes(' '+cv+' ');
    const collQHit=!cq||r._c.includes(cq);
    return textHit&&salesHit&&priHit&&collHit&&collQHit;
  });
  page=0;
  render();
}
const debouncedFilter=debounce(applyFilter,180);
q.addEventListener('input',debouncedFilter);
collq.addEventListener('input',debouncedFilter);
collsel.addEventListener('change',applyFilter);
document.getElementById('g-sales').addEventListener('click',e=>{
  const b=e.target.closest('.tbtn');if(!b)return;
  salesMode=b.dataset.sales;
  document.querySelectorAll('#g-sales .tbtn').forEach(x=>x.classList.toggle('on',x===b));
  applyFilter();
});
document.getElementById('g-pri').addEventListener('click',e=>{
  const b=e.target.closest('.tbtn');if(!b)return;
  priMode=b.dataset.pri;
  document.querySelectorAll('#g-pri .tbtn').forEach(x=>x.classList.toggle('on',x===b));
  applyFilter();
});
prevBtn.addEventListener('click',()=>{if(page>0){page--;render();window.scrollTo({top:0,behavior:'instant'});}});
nextBtn.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<filtered.length){page++;render();window.scrollTo({top:0,behavior:'instant'});}});
let opened=false;
openB.onclick=()=>{
  opened=!opened;openB.textContent=opened?'Collapse all':'Expand all';
  container.querySelectorAll('details.prod').forEach(d=>d.open=opened);
};
render();
"""
JS = JS.replace("__ROWS_JSON__", rows_json)

page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dilaksi Requirement 2 — Product Priority Guidance — All Collections</title>
<style>{css}</style>
</head>
<body>
<div class="wrap">

<a class="back" href="../index.html">&larr; Back to all members</a>

<nav class="tab-nav" role="tablist" aria-label="Dilaksi requirements">
  <a class="tab-btn" href="dilaksi.html">Requirement 1<span class="tab-label">GA4 SEO Organic Report</span></a>
  <a class="tab-btn active" href="dilaksi-req2-all-products.html">Requirement 2<span class="tab-label">Product Priority Guidance</span></a>
  <a class="tab-btn" href="dilaksi-req3-pages-for-removal.html">Requirement 3<span class="tab-label">Pages for Removal</span></a>
</nav>

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 2 — All Collections (Scope Expanded)</div>
  <h1>Product Priority Guidance — All Products, All Collections</h1>
  <div class="sub">Requested by: <strong>Dilaksi</strong> (SEO team) &middot; Store: <strong>ledsone.co.uk</strong> &middot; Generated: <strong>{gen_date}</strong> &middot; Scope: <strong>All Collections</strong> ({ncoll:,}) &middot; Date range: <strong>Last 30 Days</strong></div>
  <div class="chips">
    <span class="chip">Scope changed: 5 collections &rarr; ALL {ncoll:,} collections</span>
    <span class="chip">{nprod:,} products &middot; {nvar:,} SKU/variant rows</span>
    <span class="chip warn">Sales are net of returns</span>
    <span class="chip" style="background:#f3e8fb;color:#6a1b9a;">Demand: Semrush UK monthly search volume</span>
    <span class="chip">Organic Sessions: GA4 Data API, last 30 days, Organic Search only</span>
    <span class="chip warn">Profit Margin: N/A &mdash; COGS not in PostgreSQL (not required by any reachable rule)</span>
  </div>
</header>

<div class="cards">
  <div class="card"><div class="l">Total Products/Variants</div><div class="v">{nprod:,}</div></div>
  <div class="card"><div class="l">Total Sales (30d)</div><div class="v">&pound;{tot:,.2f}</div></div>
  <div class="card"><div class="l">Total Demand (searches/mo)</div><div class="v">{totdem:,}</div></div>
  <div class="card"><div class="l">Total Organic Sessions</div><div class="v">{totorg:,}</div></div>
  <div class="card"><div class="l">High Priority</div><div class="v">{high:,}</div></div>
  <div class="card"><div class="l">Medium Priority</div><div class="v">{med:,}</div></div>
  <div class="card"><div class="l">Low Priority</div><div class="v">{low:,}</div></div>
  <div class="card"><div class="l">Low &mdash; Flag for Review</div><div class="v">{flag:,}</div></div>
</div>

<div class="toolbar">
  <input id="q" type="text" placeholder="Search product name or SKU&hellip;">
  <input id="collq" type="text" list="colllist" autocomplete="off" placeholder="Search by collection name&hellip;">
  <datalist id="colllist">{coll_datalist_options}</datalist>
  <select id="collsel"><option value="all">All collections ({ncoll:,})</option>{coll_options}</select>
</div>
<div class="toolbar" style="top:auto;">
  <span class="tgroup" id="g-sales">
    <span class="glbl">Sales:</span>
    <button class="tbtn on" data-sales="all">All products</button>
    <button class="tbtn" data-sales="sold">With sales</button>
    <button class="tbtn" data-sales="unsold">Without sales</button>
  </span>
  <span class="tgroup" id="g-pri">
    <span class="glbl">SEO Priority:</span>
    <button class="tbtn on" data-pri="all">All</button>
    <button class="tbtn" data-pri="high">High ({high:,})</button>
    <button class="tbtn" data-pri="medium">Medium ({med:,})</button>
    <button class="tbtn" data-pri="low">Low ({low:,})</button>
    <button class="tbtn" data-pri="flag">Low &mdash; flag ({flag:,})</button>
  </span>
  <button class="tbtn" id="f-open">Expand all</button>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage">&larr; Prev</button>
  <span class="info" id="pageInfo"></span>
  <button class="tbtn" id="nextPage">Next &rarr;</button>
</div>

<div id="rowsContainer"></div>

<div class="pager">
  <button class="tbtn" onclick="document.getElementById('prevPage').click();window.scrollTo({{top:0,behavior:'instant'}});">&larr; Prev</button>
  <span class="info" id="pageInfo2"></span>
  <button class="tbtn" onclick="document.getElementById('nextPage').click();window.scrollTo({{top:0,behavior:'instant'}});">Next &rarr;</button>
</div>

<div class="legend">
  <strong>How to read each product row</strong> (hover any badge for the full explanation):<br>
  <span class="dm">Demand: 6,600 searches/mo <i class="kw">&ldquo;pendant lights&rdquo;</i></span> = UK monthly Google searches for the keyword mapped to this product (Semrush). Grey <span class="dm dm0">Demand: 0 searches/mo</span> = mapped keyword has no measurable volume; "n/a" = no keyword could be derived.<br>
  <span class="og">Organic: 31 visits (30d)</span> = visitors landing on this product page from unpaid Google search in the last 30 days (GA4 Data API, Organic Search only).<br>
  <span class="s pos">&pound;1,995.12</span> = net sales, last 30 days &middot; <span class="u">49 units</span> = units sold.<br>
  <span class="pri pri-h">SEO: High</span> / <span class="pri pri-m">SEO: Medium</span> / <span class="pri pri-l">SEO: Low</span> / <span class="pri pri-f">SEO: Low &mdash; flag for review</span> = SEO Priority from the approved 6-condition business rule (hover for matched condition + inputs).<br>
  Each product row shows every Shopify collection it belongs to (grey pills) &mdash; use the collection dropdown to filter to one collection at a time. Results are paginated ({page_size} per page) for a fast, responsive page.
</div>

<div class="rulenote"><strong>SEO Priority calculated using the approved Dilaksi Requirement 2 business rule (6 conditions, exact order).</strong> (1) Demand&lt;100 AND Sales&lt;&pound;2,000 &rarr; Low&mdash;flag &middot; (2) Sales&ge;&pound;10,000 AND Margin&ge;30% &rarr; High &middot; (3) Demand&ge;2,000 AND Organic&lt;50% of Demand &rarr; High &middot; (4) Sales&ge;&pound;4,000 AND Margin&ge;25% AND Demand&ge;500 &rarr; Medium &middot; (5) Demand&ge;500 AND Organic&ge;50% of Demand &rarr; Medium &middot; (6) else Low. Profit Margin is not available (COGS not yet in PostgreSQL) but is <strong>never required</strong> across the full catalog: the highest 30-day product sales is &pound;{maxsales:,.2f}, below both the &pound;4,000 and &pound;10,000 thresholds in rules 2 and 4 &mdash; so those rules cannot match any of the {nprod:,} rows. Nothing invented; documented in AIOS evidence.</div>

<div class="foot">
  <strong>Scope change:</strong> this page replaces the previous 5-collection scope (Pendant Lights, Wall Lights, Spider Lights, Plug-in Lighting, Table Lamps) with <strong>all {ncoll:,} Shopify collections</strong> on ledsone.co.uk, covering all {nprod:,} unique products in the catalog (previously {nprod_old:,}). Products belonging to multiple collections are shown once, with every collection they belong to listed as a pill under the title (use the dropdown to filter to one).<br>
  <strong>Data sources:</strong> Shopify Admin GraphQL Bulk Operations API (all products, variants, SKUs, collection membership &mdash; full catalog export, {nvar:,} variants) + ShopifyQL sales cube (net sales/units/orders, last 30 days, {nsalesrows:,} variant rows with nonzero activity; remaining variants verified zero) + Semrush keyword_research (`phrase_these`, UK database, {nkw:,} unique keywords across old+new batches) + GA4 Data API (property 408110563, Organic Search channel only, true last 30 days, all landing pages).<br>
  <strong>SEO Priority</strong> is calculated from the approved Requirement 2 business rule (see red-bordered rule box above); per-row calculation log saved in AIOS evidence (`2026-07-07_req2-allcol-seo-priority-log.csv`).<br>
  <strong>Performance:</strong> this page renders {nprod:,} products client-side in pages of {page_size} (instead of all at once) for a fast, responsive experience — filtering runs over an in-memory dataset, not the DOM.
</div>

</div>
<script>{js}</script>
</body>
</html>""".format(
    css=CSS, js=JS, gen_date="2026-07-07", ncoll=len(coll_list), nprod=len(rows), nvar=sum(r["n_variants"] for r in rows),
    tot=total_sales, totdem=total_demand, totorg=total_organic,
    high=high_n, med=med_n, low=low_n, flag=flag_n, page_size=100,
    coll_options=coll_options, coll_datalist_options=coll_datalist_options, maxsales=max(r["sales"] for r in rows),
    nprod_old=1231, nsalesrows=1705, nkw=1091,
)

out1 = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html"
out2 = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/dilaksi/dilaksi-req2-all-collections-product-priority.html"
open(out1, "w", encoding="utf-8").write(page)
open(out2, "w", encoding="utf-8").write(page)
print("written:", out1, len(page)//1024, "KB")
print("written:", out2, len(page)//1024, "KB")
