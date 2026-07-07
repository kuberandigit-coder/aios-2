import json, html, os, collections

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

rows = json.load(open(p("2026-07-07_kamsi_req5_rows.json"), encoding="utf-8"))

def esc(s):
    return html.escape(s or "")

total = len(rows)
missing_title_n = sum(1 for r in rows if r["title_missing"])
missing_desc_n = sum(1 for r in rows if r["desc_missing"])
both_missing_n = sum(1 for r in rows if r["title_missing"] and r["desc_missing"])
ok_n = sum(1 for r in rows if r["action_needed"] == "OK")
action_counts = collections.Counter(r["action_needed"] for r in rows)
last_updated = max((r["last_updated"] for r in rows if r["last_updated"]), default="")

coll_counts = collections.Counter(r["collection_type"] for r in rows)
coll_list = sorted(coll_counts.items(), key=lambda x: -x[1])
coll_options = "".join('<option value="{h}">{name} ({n})</option>'.format(h=esc(c), name=esc(c), n=n) for c, n in coll_list)

action_list = sorted(action_counts.items(), key=lambda x: -x[1])
action_options = "".join('<option value="{h}">{name} ({n})</option>'.format(h=esc(a), name=esc(a), n=n) for a, n in action_list)

# ---- Compact row data embedded as JSON — rendered client-side, paginated/sortable ----
rows_data = []
for r in rows:
    rows_data.append({
        "u": r["page_url"], "c": r["collection_type"], "t": r["product_title"],
        "d": r["product_description"][:400], "mt": r["meta_title"], "md": r["meta_description"],
        "tl": r["title_length"], "dl": r["description_length"], "lu": r["last_updated"],
        "a": r["action_needed"], "tm": r["title_missing"], "dm": r["desc_missing"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

CSS = """
:root{--ink:#1a2233;--muted:#5b6577;--line:#e3e7ee;--bg:#f5f7fa;--card:#fff;--accent:#1f5eff;--accent-soft:#eaf0ff;--good:#0a7d4f;--na:#9aa3b2;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Segoe UI",system-ui,Arial,sans-serif;background:var(--bg);color:var(--ink);padding:28px 16px;}
.wrap{max-width:1400px;margin:0 auto;}
.back{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--muted);text-decoration:none;font-size:13px;font-weight:600;transition:all .15s;}
.back:hover{background:var(--accent-soft);color:var(--accent);border-color:var(--accent);}
.tab-nav{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px;}
.tab-btn{border:none;background:transparent;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted);transition:background .15s,color .15s;white-space:nowrap;text-decoration:none;display:inline-block;text-align:center;font-family:inherit;}
.tab-btn:hover{background:var(--accent-soft);color:var(--accent);}
.tab-btn.active{background:var(--accent);color:#fff;}
.tab-btn .tab-label{display:block;font-size:11px;font-weight:400;margin-top:1px;opacity:.8;}
@media(max-width:700px){.tab-btn{padding:7px 12px;font-size:12px;}}
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
#q, #collsel, #actionsel{flex:1;min-width:200px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}
.tbtn{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);}
.tbtn.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.tbtn:disabled{opacity:.4;cursor:default;}
.tgroup{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.tgroup .glbl{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-right:2px;}
.pager{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:10px 0;flex-wrap:wrap;}
.pager .info{font-size:12.5px;color:var(--muted);font-weight:600;}
.legend{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);line-height:1.8;}
.legend strong{color:var(--ink);}
.badge{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;color:#fff;}
.b-ok{background:#0a7d4f;}
.b-warn{background:#ef6c00;}
.b-danger{background:#c62828;}
#sortsel{padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:#fff;min-width:170px;}
details.prod{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:6px;overflow:hidden;}
details.prod summary{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;list-style:none;flex-wrap:wrap;}
details.prod summary::-webkit-details-marker{display:none;}
details.prod summary:hover{background:var(--accent-soft);}
details.prod .rowmain{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1;min-width:0;}
details.prod .t{font-size:13.5px;font-weight:600;flex:1;min-width:180px;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
details.prod .ct{font-size:11px;color:var(--muted);background:#f0f3f8;border-radius:999px;padding:3px 10px;white-space:nowrap;}
details.prod .lens{font-size:11px;color:var(--muted);white-space:nowrap;}
details.prod .caret{font-size:11px;color:var(--muted);margin-left:auto;flex-shrink:0;}
.detail{padding:12px 16px 14px;border-top:1px solid var(--line);background:#fafbfd;font-size:12.5px;}
.detail .row{margin-bottom:8px;}
.detail .row:last-child{margin-bottom:0;}
.detail .k{font-weight:700;color:var(--ink);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;color:#42506a;}
.detail .v{color:var(--muted);line-height:1.55;word-break:break-word;}
.detail .v a{color:var(--accent);text-decoration:none;font-weight:600;}
.detail .v i{color:var(--na);font-style:normal;}
.foot{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px;font-size:12.5px;color:var(--muted);line-height:1.65;}
.foot strong{color:var(--ink);}
@media(max-width:600px){h1{font-size:18px;}.card .v{font-size:17px;}details.prod .t{max-width:100%;}}
"""

JS = """
const ROWS=__ROWS_JSON__;
const PAGE_SIZE=100;
const q=document.getElementById('q'),collsel=document.getElementById('collsel'),actionsel=document.getElementById('actionsel');
const tmYes=document.getElementById('tm-yes'),tmNo=document.getElementById('tm-no'),tmAll=document.getElementById('tm-all');
const dmYes=document.getElementById('dm-yes'),dmNo=document.getElementById('dm-no'),dmAll=document.getElementById('dm-all');
const container=document.getElementById('rowsContainer'),pageInfo=document.getElementById('pageInfo'),prevBtn=document.getElementById('prevPage'),nextBtn=document.getElementById('nextPage');
let tmMode='all',dmMode='all',page=0,filtered=ROWS,sortKey='t',sortDir=1;

for(const r of ROWS){
  r._t=r.t.toLowerCase(); r._u=r.u.toLowerCase(); r._d=r.d.toLowerCase();
}
function esc(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function badgeClass(a){
  if(a==='OK') return 'b-ok';
  if(a==='Add Meta Title and Meta Description') return 'b-danger';
  return 'b-warn';
}
function debounce(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}

function rowHtml(r){
  return `<details class="prod">
    <summary>
      <div class="rowmain">
        <span class="t" title="${esc(r.t)}">${esc(r.t)}</span>
        <span class="ct">${esc(r.c)}</span>
        <span class="lens">T:${r.tl} &middot; D:${r.dl}</span>
      </div>
      <span class="badge ${badgeClass(r.a)}">${esc(r.a)}</span>
      <span class="caret">&#9662; details</span>
    </summary>
    <div class="detail">
      <div class="row"><span class="k">Page URL</span><span class="v"><a href="https://ledsone.co.uk${esc(r.u)}" target="_blank" rel="noopener">${esc(r.u)}</a></span></div>
      <div class="row"><span class="k">Product Description</span><span class="v">${esc(r.d)||'<i>(none)</i>'}</span></div>
      <div class="row"><span class="k">Meta Title</span><span class="v">${esc(r.mt)||'<i>(none)</i>'}</span></div>
      <div class="row"><span class="k">Meta Description</span><span class="v">${esc(r.md)||'<i>(none)</i>'}</span></div>
      <div class="row"><span class="k">Last Updated</span><span class="v">${esc((r.lu||'').slice(0,10))||'<i>(none)</i>'}</span></div>
    </div>
  </details>`;
}

function render(){
  const start=page*PAGE_SIZE;
  const pageRows=filtered.slice(start,start+PAGE_SIZE);
  container.innerHTML=pageRows.map(rowHtml).join('');
  const shownFrom=filtered.length?start+1:0;
  const shownTo=Math.min(start+PAGE_SIZE,filtered.length);
  pageInfo.textContent=`Showing ${shownFrom.toLocaleString()}–${shownTo.toLocaleString()} of ${filtered.length.toLocaleString()} products`;
  prevBtn.disabled=page<=0;
  nextBtn.disabled=start+PAGE_SIZE>=filtered.length;
}

function applySort(){
  filtered.sort((a,b)=>{
    let av=a[sortKey], bv=b[sortKey];
    if(typeof av==='string'){av=av.toLowerCase();bv=bv.toLowerCase();}
    if(av<bv) return -1*sortDir;
    if(av>bv) return 1*sortDir;
    return 0;
  });
}
function applyFilter(){
  const s=q.value.trim().toLowerCase();
  const cv=collsel.value;
  const av=actionsel.value;
  filtered=ROWS.filter(r=>{
    const textHit=!s||r._t.includes(s)||r._u.includes(s)||r._d.includes(s);
    const collHit=cv==='all'||r.c===cv;
    const actionHit=av==='all'||r.a===av;
    const tmHit=tmMode==='all'||(tmMode==='yes'?r.tm:!r.tm);
    const dmHit=dmMode==='all'||(dmMode==='yes'?r.dm:!r.dm);
    return textHit&&collHit&&actionHit&&tmHit&&dmHit;
  });
  applySort();
  page=0;
  render();
}
const debouncedFilter=debounce(applyFilter,180);
q.addEventListener('input',debouncedFilter);
collsel.addEventListener('change',applyFilter);
actionsel.addEventListener('change',applyFilter);

function wireToggle(yesBtn,noBtn,allBtn,setMode){
  yesBtn.addEventListener('click',()=>{setMode('yes');[yesBtn,noBtn,allBtn].forEach(b=>b.classList.remove('on'));yesBtn.classList.add('on');applyFilter();});
  noBtn.addEventListener('click',()=>{setMode('no');[yesBtn,noBtn,allBtn].forEach(b=>b.classList.remove('on'));noBtn.classList.add('on');applyFilter();});
  allBtn.addEventListener('click',()=>{setMode('all');[yesBtn,noBtn,allBtn].forEach(b=>b.classList.remove('on'));allBtn.classList.add('on');applyFilter();});
}
wireToggle(tmYes,tmNo,tmAll,(m)=>tmMode=m);
wireToggle(dmYes,dmNo,dmAll,(m)=>dmMode=m);

prevBtn.addEventListener('click',()=>{if(page>0){page--;render();window.scrollTo({top:0,behavior:'instant'});}});
nextBtn.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<filtered.length){page++;render();window.scrollTo({top:0,behavior:'instant'});}});

applySort();
render();
"""
JS = JS.replace("__ROWS_JSON__", rows_json)

TITLE = "Kamsi Requirement 5 — Missing Meta Title &amp; Meta Description Detection"
SUBTITLE = "All Shopify product pages checked for missing or auto-generated SEO metadata."

page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<div class="wrap">

<a class="back" href="../index.html">&larr; Back to all members</a>

<nav class="tab-nav" role="tablist" aria-label="Kamsi requirements">
  <a class="tab-btn" href="kamsi-req1-slow-moving-products.html">Requirement 1<span class="tab-label">Slow-Moving Product Visibility</span></a>
  <a class="tab-btn" href="kamsi-req2-low-ctr-pages.html">Requirement 2<span class="tab-label">Low CTR Page Identification</span></a>
  <a class="tab-btn" href="kamsi-req3-core-ga4-seo.html">Requirement 3<span class="tab-label">Core GA4 Data for SEO</span></a>
  <a class="tab-btn" href="kamsi-req4-product-priority-guidance.html">Requirement 4<span class="tab-label">Product Priority Guidance</span></a>
  <a class="tab-btn active" href="kamsi-req5-missing-meta-detection.html">Requirement 5<span class="tab-label">Missing Meta Title &amp; Description</span></a>
</nav>

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 5 &mdash; Missing Meta Title &amp; Meta Description Detection</div>
  <h1>{title_h1}</h1>
  <div class="sub">{subtitle} &middot; Store: <strong>ledsone.co.uk</strong> &middot; Last updated: <strong>{last_updated}</strong></div>
  <div class="chips">
    <span class="chip">{total:,} products checked</span>
    <span class="chip warn">Shopify Admin GraphQL &mdash; read-only, no data modified</span>
    <span class="chip">Scope: all Shopify product pages</span>
  </div>
</header>

<div class="cards">
  <div class="card"><div class="l">Total Products Checked</div><div class="v">{total:,}</div></div>
  <div class="card"><div class="l">Missing Meta Title</div><div class="v">{missing_title:,}</div></div>
  <div class="card"><div class="l">Missing Meta Description</div><div class="v">{missing_desc:,}</div></div>
  <div class="card"><div class="l">Both Missing</div><div class="v">{both_missing:,}</div></div>
  <div class="card"><div class="l">OK Products</div><div class="v">{ok:,}</div></div>
</div>

<div class="toolbar">
  <input id="q" type="text" placeholder="Search product title, URL, or description&hellip;">
  <select id="collsel"><option value="all">All Collection Types</option>{coll_options}</select>
  <select id="actionsel"><option value="all">All Action Needed</option>{action_options}</select>
</div>
<div class="toolbar" style="top:auto;">
  <span class="tgroup">
    <span class="glbl">Missing Meta Title:</span>
    <button class="tbtn on" id="tm-all">All</button>
    <button class="tbtn" id="tm-yes">Yes</button>
    <button class="tbtn" id="tm-no">No</button>
  </span>
  <span class="tgroup">
    <span class="glbl">Missing Meta Description:</span>
    <button class="tbtn on" id="dm-all">All</button>
    <button class="tbtn" id="dm-yes">Yes</button>
    <button class="tbtn" id="dm-no">No</button>
  </span>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage">&larr; Prev</button>
  <span class="info" id="pageInfo"></span>
  <button class="tbtn" id="nextPage">Next &rarr;</button>
</div>

<div class="legend">
  <strong>Evidence note:</strong> Shopify auto-filled SEO metadata is treated as missing when it matches the product title or product description.<br>
  <strong>How Action Needed is decided:</strong> <span class="badge b-danger">Add Meta Title and Meta Description</span> both fields blank &middot; <span class="badge b-warn">Add Meta Title</span> / <span class="badge b-warn">Add Meta Description</span> one field blank &middot; <span class="badge b-warn">Rewrite Meta Title</span> / <span class="badge b-warn">Rewrite Meta Description</span> field is present but auto-generated (matches the product title/description) &middot; <span class="badge b-ok">OK</span> both manually written and distinct from the source text.<br>
  Each row shows Product Title, Collection Type, Title/Description character counts (T:/D:), and the Action Needed badge on one line &mdash; no horizontal scrolling. Click any row to expand the full Page URL, Product Description, Meta Title, Meta Description, and Last Updated date.
</div>

<div id="rowsContainer"></div>

<div class="foot">
  <strong>Detection logic:</strong> Meta Title is missing if the SEO title field is blank, or if it exactly matches the product title after normalizing (HTML stripped, whitespace collapsed, case-insensitive). Meta Description is missing if the SEO description field is blank, or if it exactly matches the product description (or the first 160 characters of it) after the same normalization.<br>
  <strong>Data source:</strong> Shopify Admin GraphQL Bulk Operations API, read-only (product title, description, SEO title/description, product type, collections, tags, updated-at) &mdash; {total:,} products, full catalog. No PostgreSQL, GA4, or GSC data used. No Shopify data modified.<br>
  <strong>Title/Description Length:</strong> character count of the Meta Title/Description field; shown as <strong>0</strong> when the field is blank (documented choice, not invented).
</div>

</div>
<script>{js}</script>
</body>
</html>""".format(
    title=TITLE, css=CSS, js=JS, title_h1=TITLE.replace("&amp;", "&"), subtitle=SUBTITLE,
    last_updated=last_updated[:10] if last_updated else "N/A",
    total=total, missing_title=missing_title_n, missing_desc=missing_desc_n, both_missing=both_missing_n, ok=ok_n,
    coll_options=coll_options, action_options=action_options,
)

out1 = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/digital-marketing-member-pages/pages/kamsi-req5-missing-meta-detection.html"
out2 = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/Kamsi/kamsi-requirement-5-missing-meta-detection.html"
open(out1, "w", encoding="utf-8").write(page)
open(out2, "w", encoding="utf-8").write(page)
print("written:", out1, len(page)//1024, "KB")
print("written:", out2, len(page)//1024, "KB")
