import json, html, collections

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
ROWS_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req6_rows.json"

c = open(PATH, encoding="utf-8").read()
open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_before_req6_add_backup.html", "w", encoding="utf-8").write(c)

rows = json.load(open(ROWS_PATH, encoding="utf-8"))


def esc(s):
    return html.escape(str(s) if s is not None else "")


total_variant_rows = len(rows)
by_sku = {}
for r in rows:
    if r["sku"]:
        by_sku.setdefault(r["sku"], []).append(r)
unique_skus = len(by_sku)
duplicate_skus = sum(1 for g in by_sku.values() if len(g) >= 2)
rows_with_dup_sku = sum(1 for r in rows if r["duplicate"])
price_mismatch_skus_set = set()
for sku, g in by_sku.items():
    if g[0]["price_mismatch"]:
        price_mismatch_skus_set.add(sku)
price_mismatch_skus = len(price_mismatch_skus_set)
blank_sku_rows = sum(1 for r in rows if not r["sku"])
last_checked = rows[0]["last_checked"] if rows else ""

status_counts = collections.Counter(r["product_status"] for r in rows)
status_list = sorted(status_counts.items(), key=lambda x: -x[1])
status_options = "".join(
    '<option value="{h}">{name} ({n})</option>'.format(h=esc(s), name=esc(s), n=n) for s, n in status_list
)

# compact row data for client-side render
rows_data = []
for r in rows:
    rows_data.append({
        "s": r["sku"], "t": r["product_title"], "vt": r["variant_title"], "u": r["listing_url"],
        "cp": r["current_price"], "xp": r["compare_price"],
        "d": r["duplicate"], "dc": r["duplicate_count"], "pm": r["price_mismatch"],
        "mu": r["matching_urls"], "st": r["product_status"], "lc": r["last_checked"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

CSS = """
.req6-badge{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;color:#fff;}
.r6-dup-yes{background:#ef6c00;}
.r6-dup-no{background:#0a7d4f;}
.r6-mismatch-yes{background:#c62828;}
.r6-mismatch-no{background:#0a7d4f;}
table.r6t{width:100%;border-collapse:collapse;font-size:12.5px;min-width:1200px;}
table.r6t th{text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#42506a;border-bottom:2px solid var(--line);background:#fafbfd;white-space:nowrap;cursor:pointer;}
table.r6t td{padding:8px 12px;border-bottom:1px solid #eef1f6;vertical-align:top;white-space:nowrap;}
table.r6t td.wrap-cell{white-space:normal;max-width:260px;overflow:hidden;text-overflow:ellipsis;}
table.r6t td.num{text-align:right;}
.r6-tablewrap{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto;margin-bottom:16px;}
"""

JS_TEMPLATE = """
const ROWS6=__ROWS6_JSON__;
const PAGE_SIZE6=100;
const q6=document.getElementById('q6'),dupsel6=document.getElementById('dupsel6'),mismatchsel6=document.getElementById('mismatchsel6'),statussel6=document.getElementById('statussel6');
const tbody6=document.getElementById('tbody6'),pageInfo6=document.getElementById('pageInfo6'),prevBtn6=document.getElementById('prevPage6'),nextBtn6=document.getElementById('nextPage6');
let page6=0, filtered6=ROWS6, sortKey6='t', sortDir6=1;

for(const r of ROWS6){ r._s=(r.s||'').toLowerCase(); r._t=(r.t||'').toLowerCase(); r._u=(r.u||'').toLowerCase(); }
function esc6(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gbp6(v){ return v==null ? '-' : '£'+Number(v).toFixed(2); }

function rowHtml6(r){
  return `<tr>
    <td class="wrap-cell">${esc6(r.s)||'<em>(blank)</em>'}</td>
    <td class="wrap-cell">${esc6(r.t)}</td>
    <td class="wrap-cell">${esc6(r.vt)}</td>
    <td class="wrap-cell"><a href="https://ledsone.co.uk${esc6(r.u)}" target="_blank" rel="noopener">${esc6(r.u)}</a></td>
    <td class="num">${gbp6(r.cp)}</td>
    <td class="num">${gbp6(r.xp)}</td>
    <td><span class="req6-badge ${r.d?'r6-dup-yes':'r6-dup-no'}">${r.d?'Yes':'No'}</span></td>
    <td class="num">${r.dc}</td>
    <td><span class="req6-badge ${r.pm?'r6-mismatch-yes':'r6-mismatch-no'}">${r.pm?'Yes':'No'}</span></td>
    <td class="wrap-cell">${(r.mu||[]).map(u=>esc6(u)).join('<br>')}</td>
    <td>${esc6(r.lc)}</td>
  </tr>`;
}

function applySort6(){
  filtered6.sort((a,b)=>{
    let av=a[sortKey6], bv=b[sortKey6];
    if(av==null) av=''; if(bv==null) bv='';
    if(typeof av==='string'){av=av.toLowerCase();bv=String(bv).toLowerCase();}
    if(av<bv) return -1*sortDir6;
    if(av>bv) return 1*sortDir6;
    return 0;
  });
}

function render6(){
  const start=page6*PAGE_SIZE6;
  const pageRows=filtered6.slice(start,start+PAGE_SIZE6);
  tbody6.innerHTML=pageRows.map(rowHtml6).join('');
  const shownFrom=filtered6.length?start+1:0;
  const shownTo=Math.min(start+PAGE_SIZE6,filtered6.length);
  pageInfo6.textContent=`Showing ${shownFrom.toLocaleString()}\\u2013${shownTo.toLocaleString()} of ${filtered6.length.toLocaleString()} rows`;
  prevBtn6.disabled=page6<=0;
  nextBtn6.disabled=start+PAGE_SIZE6>=filtered6.length;
}

function applyFilter6(){
  const s=q6.value.trim().toLowerCase();
  const dv=dupsel6.value, mv=mismatchsel6.value, sv=statussel6.value;
  filtered6=ROWS6.filter(r=>{
    const textHit=!s||r._s.includes(s)||r._t.includes(s)||r._u.includes(s);
    const dupHit=dv==='all'||(dv==='yes'?r.d:!r.d);
    const mismatchHit=mv==='all'||(mv==='yes'?r.pm:!r.pm);
    const statusHit=sv==='all'||r.st===sv;
    return textHit&&dupHit&&mismatchHit&&statusHit;
  });
  applySort6();
  page6=0;
  render6();
}
function debounce6(fn,ms){let t;return function(...a){clearTimeout(t);t=setTimeout(()=>fn.apply(this,a),ms);};}
const debouncedFilter6=debounce6(applyFilter6,180);
q6.addEventListener('input',debouncedFilter6);
dupsel6.addEventListener('change',applyFilter6);
mismatchsel6.addEventListener('change',applyFilter6);
statussel6.addEventListener('change',applyFilter6);
prevBtn6.addEventListener('click',()=>{if(page6>0){page6--;render6();window.scrollTo({top:0,behavior:'instant'});}});
nextBtn6.addEventListener('click',()=>{if((page6+1)*PAGE_SIZE6<filtered6.length){page6++;render6();window.scrollTo({top:0,behavior:'instant'});}});

const SORT_KEYS6=['s','t','vt','u','cp','xp','d','dc','pm','mu','lc'];
document.querySelectorAll('#reqsix-table th[data-k]').forEach(function(th){
  th.addEventListener('click',function(){
    const k=th.getAttribute('data-k');
    if(sortKey6===k) sortDir6=-sortDir6; else { sortKey6=k; sortDir6=1; }
    applySort6(); render6();
  });
});

function exp6(){
  var hdr=['SKU','Product Title','Variant Title','Listing URL','Current Price (GBP)','Compare Price (GBP)','Duplicate','Duplicate Count','Price Mismatch','Matching Listing URLs','Product Status','Last Checked'];
  var lines=[hdr.join(',')];
  filtered6.forEach(function(r){
    var vals=[r.s, r.t, r.vt, 'https://ledsone.co.uk'+r.u,
      (r.cp==null?'':r.cp), (r.xp==null?'':r.xp), (r.d?'Yes':'No'), r.dc, (r.pm?'Yes':'No'),
      (r.mu||[]).join(' | '), r.st, r.lc];
    lines.push(vals.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(','));
  });
  var blob=new Blob([lines.join(String.fromCharCode(10))],{type:'text/csv'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='kamsi-req6-duplicate-price-check-__LASTCHECKED__.csv'; a.click();
}
window.exp6=exp6;

applySort6();
render6();
"""
JS = JS_TEMPLATE.replace("__ROWS6_JSON__", rows_json).replace("__LASTCHECKED__", last_checked)

PANEL_HTML = """<div id="tab-panel-6" class="tab-panel">


<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 6 &mdash; Duplicate Listing &amp; Price Check</div>
  <h1>Kamsi Requirement 6 &mdash; Duplicate Listing &amp; Price Check</h1>
  <div class="sub">Shopify full catalog SKU duplicate and price mismatch audit. &middot; Store: <strong>ledsone.co.uk</strong> &middot; Last checked: <strong>{last_checked}</strong></div>
  <div class="chips">
    <span class="chip">{total_rows:,} variant rows checked</span>
    <span class="chip warn">Shopify Admin GraphQL Bulk Operations API &mdash; read-only, no data modified</span>
    <span class="chip">Scope: full catalog, all products &amp; variants</span>
  </div>
</header>

<div class="cards">
  <div class="card"><div class="l">Total Variant Rows Checked</div><div class="v">{total_rows:,}</div></div>
  <div class="card"><div class="l">Unique SKUs Checked</div><div class="v">{unique_skus:,}</div></div>
  <div class="card"><div class="l">Duplicate SKUs</div><div class="v">{duplicate_skus:,}</div></div>
  <div class="card"><div class="l">Rows With Duplicate SKU</div><div class="v">{rows_with_dup:,}</div></div>
  <div class="card"><div class="l">Price Mismatch SKUs</div><div class="v">{price_mismatch_skus:,}</div></div>
  <div class="card"><div class="l">Blank SKU Rows</div><div class="v">{blank_sku_rows:,}</div></div>
</div>

<div class="toolbar">
  <input id="q6" type="text" placeholder="Search SKU, product title, or URL&hellip;" style="flex:1;min-width:180px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;">
  <label>Duplicate? <select id="dupsel6"><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  <label>Price Mismatch? <select id="mismatchsel6"><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  <label>Product Status <select id="statussel6"><option value="all">All Statuses</option>{status_options}</select></label>
  <button class="tbtn" onclick="exp6()">Export CSV</button>
</div>

<div class="pager">
  <button class="tbtn" id="prevPage6">&larr; Prev</button>
  <span class="info" id="pageInfo6"></span>
  <button class="tbtn" id="nextPage6">Next &rarr;</button>
</div>

<div class="r6-tablewrap">
<table class="r6t" id="reqsix-table">
  <thead><tr>
    <th data-k="s">SKU</th>
    <th data-k="t">Product Title</th>
    <th data-k="vt">Variant Title</th>
    <th data-k="u">Listing URL</th>
    <th data-k="cp" class="num">Current Price (&pound;)</th>
    <th data-k="xp" class="num">Compare Price (&pound;)</th>
    <th data-k="d">Duplicate?</th>
    <th data-k="dc" class="num">Duplicate Count</th>
    <th data-k="pm">Price Mismatch?</th>
    <th data-k="mu">Matching Listing URLs</th>
    <th data-k="lc">Last Checked</th>
  </tr></thead>
  <tbody id="tbody6"></tbody>
</table>
</div>

<div class="foot">
  <strong>Duplicate logic:</strong> Duplicate? = Yes if the same SKU appears on 2 or more Shopify product/variant listing rows anywhere in the full catalog; No if it appears only once. Blank/null SKUs are excluded from duplicate calculation (shown separately in the Blank SKU Rows KPI, Duplicate?/Price Mismatch? forced to No for these rows).<br>
  <strong>Price Mismatch logic:</strong> Yes only if Duplicate? = Yes AND not all rows sharing that SKU have the same Current Price. Compare Price is shown for reference only and is never used to decide a mismatch.<br>
  <strong>Data source:</strong> Shopify Admin GraphQL Bulk Operations API, read-only (product id/title/handle/status/updatedAt, variant id/title/sku/price/compareAtPrice) &mdash; {total_rows:,} variant rows across the full catalog. No PostgreSQL data used as final source. No Shopify data modified.
</div>

</div>""".format(
    last_checked=last_checked, total_rows=total_variant_rows, unique_skus=unique_skus,
    duplicate_skus=duplicate_skus, rows_with_dup=rows_with_dup_sku,
    price_mismatch_skus=price_mismatch_skus, blank_sku_rows=blank_sku_rows,
    status_options=status_options,
)

# ---- 1. add CSS ----
css_marker = "<style>\n\n.tab-panel{display:none;}\n.tab-panel.active{display:block;}\n\n</style>\n</head>"
assert css_marker in c
c = c.replace(css_marker, "<style>\n" + CSS + "\n</style>\n" + css_marker, 1)

# ---- 2. add tab-nav button (Req6, new) ----
old_nav_end = '<button class="tab-btn" onclick="showTab(5)">Requirement 5<span class="tab-label">Missing Meta Title &amp; Description</span></button>\n</nav>'
assert old_nav_end in c, "nav marker not found"
new_nav_end = old_nav_end.replace(
    "</nav>",
    '\n  <button class="tab-btn" onclick="showTab(6)">Requirement 6<span class="tab-label">Duplicate Listing &amp; Price Check</span></button>\n</nav>'
)
c = c.replace(old_nav_end, new_nav_end, 1)

# ---- 3. insert panel-6 after panel-5's closing, before the wrap-closer and shared <script> ----
panel5_close_marker = "\n</div>\n\n</div>\n<script>"
assert c.count(panel5_close_marker) == 1
new_block = "\n</div>\n\n" + PANEL_HTML + "\n\n</div>\n<script>"
c = c.replace(panel5_close_marker, new_block, 1)

# ---- 4. insert req6's IIFE before the closing </script> ----
closing_script_marker = "\n</script>\n</body>\n</html>"
assert c.count(closing_script_marker) == 1
iife6 = "(function(){\n" + JS + "\n})();\n"
c = c.replace(closing_script_marker, "\n" + iife6 + "</script>\n</body>\n</html>", 1)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
print("KPIs -> total_rows:", total_variant_rows, "unique_skus:", unique_skus, "duplicate_skus:", duplicate_skus,
      "rows_with_dup:", rows_with_dup_sku, "price_mismatch_skus:", price_mismatch_skus, "blank_sku_rows:", blank_sku_rows)
