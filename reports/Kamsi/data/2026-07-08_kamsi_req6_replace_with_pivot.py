import json, html, collections

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
PIVOT_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req6_pivot_rows.json"

c = open(PATH, encoding="utf-8").read()

pivot_rows = json.load(open(PIVOT_PATH, encoding="utf-8"))


def esc(s):
    return html.escape(str(s) if s is not None else "")


total_rows = len(pivot_rows)
unique_skus = sum(1 for r in pivot_rows if r["sku"])
duplicate_skus = sum(1 for r in pivot_rows if r["duplicate"])
rows_with_dup = sum(r["duplicate_count"] for r in pivot_rows if r["duplicate"])
price_mismatch_skus = sum(1 for r in pivot_rows if r["price_mismatch"])
blank_sku_rows = sum(1 for r in pivot_rows if not r["sku"])
last_checked = pivot_rows[0]["last_checked"] if pivot_rows else ""

status_counts = collections.Counter(r["status"] for r in pivot_rows)
status_list = sorted(status_counts.items(), key=lambda x: -x[1])
status_options = "".join(
    '<option value="{h}">{name} ({n})</option>'.format(h=esc(s), name=esc(s), n=n) for s, n in status_list
)

# compact row data for client-side render (up to 3 listing slots)
rows_data = []
for r in pivot_rows:
    slots = []
    for i in range(3):
        if i < len(r["listings"]):
            L = r["listings"][i]
            slots.append({"u": L["url"], "t": L["title"], "cp": L["cp"], "xp": L["xp"]})
        else:
            slots.append(None)
    rows_data.append({
        "s": r["sku"], "l": slots, "ex": r["extra"],
        "d": r["duplicate"], "dc": r["duplicate_count"], "pm": r["price_mismatch"],
        "st": r["status"], "lc": r["last_checked"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

PANEL_HTML = """<div id="tab-panel-6" class="tab-panel">


<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 6 &mdash; Duplicate Listing &amp; Price Check</div>
  <h1>Kamsi Requirement 6 &mdash; Duplicate Listing &amp; Price Check</h1>
  <div class="sub">Shopify full catalog SKU duplicate and price mismatch audit. &middot; Store: <strong>ledsone.co.uk</strong> &middot; Last checked: <strong>{last_checked}</strong></div>
  <div class="chips">
    <span class="chip">{unique_skus:,} unique SKUs (+ {blank_sku_rows} blank-SKU rows)</span>
    <span class="chip warn">Shopify Admin GraphQL Bulk Operations API &mdash; read-only, no data modified</span>
    <span class="chip">Scope: full catalog, all products &amp; variants &middot; one row per SKU, up to 3 listings shown side-by-side</span>
  </div>
</header>

<div class="cards">
  <div class="card"><div class="l">Total Variant Rows Checked</div><div class="v">17,542</div></div>
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
    <th data-k="l0u">Listing URL 1</th>
    <th data-k="l0t">Product Title 1</th>
    <th data-k="l0cp" class="num">Current Price 1 (&pound;)</th>
    <th data-k="l0xp" class="num">Compare Price 1 (&pound;)</th>
    <th data-k="l1u">Listing URL 2</th>
    <th data-k="l1t">Product Title 2</th>
    <th data-k="l1cp" class="num">Current Price 2 (&pound;)</th>
    <th data-k="l1xp" class="num">Compare Price 2 (&pound;)</th>
    <th data-k="l2u">Listing URL 3</th>
    <th data-k="l2t">Product Title 3</th>
    <th data-k="l2cp" class="num">Current Price 3 (&pound;)</th>
    <th data-k="l2xp" class="num">Compare Price 3 (&pound;)</th>
    <th data-k="d">Duplicate?</th>
    <th data-k="dc" class="num">Duplicate Count</th>
    <th data-k="pm">Price Mismatch?</th>
    <th data-k="lc">Last Checked</th>
  </tr></thead>
  <tbody id="tbody6"></tbody>
</table>
</div>

<div class="foot">
  <strong>Table format:</strong> one row per unique SKU. Up to 3 duplicate listings are shown side-by-side (Listing URL / Product Title / Current Price / Compare Price, repeated for slots 1&ndash;3); if a SKU appears on more than 3 listings, the 3rd Listing URL column shows &ldquo;+N more&rdquo; and the full list is in the underlying CSV export data. <strong>Note:</strong> most duplicate SKUs in this catalog belong to genuinely different products (2,385 of 2,402 duplicate SKUs have more than one distinct Product Title) &mdash; this is not the same product listed twice under one URL, it's the same internal SKU code reused across different product listings.<br>
  <strong>Duplicate logic:</strong> Duplicate? = Yes if the same SKU appears on 2 or more Shopify product/variant listing rows anywhere in the full catalog; No if it appears only once. Blank/null SKUs are excluded from duplicate calculation (Blank SKU Rows KPI), shown as their own row with Duplicate?/Price Mismatch? forced to No.<br>
  <strong>Price Mismatch logic:</strong> Yes only if Duplicate? = Yes AND not all rows sharing that SKU have the same Current Price. Compare Price is shown for reference only and is never used to decide a mismatch.<br>
  <strong>Data source:</strong> Shopify Admin GraphQL Bulk Operations API, read-only (product id/title/handle/status/updatedAt, variant id/title/sku/price/compareAtPrice) &mdash; 17,542 variant rows across the full catalog. No PostgreSQL data used as final source. No Shopify data modified.
</div>

</div>""".format(
    last_checked=last_checked, unique_skus=unique_skus, blank_sku_rows=blank_sku_rows,
    duplicate_skus=duplicate_skus, rows_with_dup=rows_with_dup, price_mismatch_skus=price_mismatch_skus,
    status_options=status_options,
)

JS = """
const ROWS6=__ROWS6_JSON__;
const PAGE_SIZE6=100;
const q6=document.getElementById('q6'),dupsel6=document.getElementById('dupsel6'),mismatchsel6=document.getElementById('mismatchsel6'),statussel6=document.getElementById('statussel6');
const tbody6=document.getElementById('tbody6'),pageInfo6=document.getElementById('pageInfo6'),prevBtn6=document.getElementById('prevPage6'),nextBtn6=document.getElementById('nextPage6');
let page6=0, filtered6=ROWS6, sortKey6='s', sortDir6=1;

for(const r of ROWS6){
  r._s=(r.s||'').toLowerCase();
  r._blob=((r.s||'')+' '+r.l.map(function(x){return x?(x.u+' '+x.t):'';}).join(' ')).toLowerCase();
}
function esc6(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gbp6(v){ return v==null ? '-' : '£'+Number(v).toFixed(2); }

function slotCells(slot, isLast, extra){
  if(!slot){
    return '<td>-</td><td>-</td><td class="num">-</td><td class="num">-</td>';
  }
  var urlCell = '<a href="https://ledsone.co.uk'+esc6(slot.u)+'" target="_blank" rel="noopener">'+esc6(slot.u)+'</a>';
  if(isLast && extra > 0){ urlCell += ' <em>(+' + extra + ' more)</em>'; }
  return '<td class="wrap-cell">'+urlCell+'</td><td class="wrap-cell">'+esc6(slot.t)+'</td><td class="num">'+gbp6(slot.cp)+'</td><td class="num">'+gbp6(slot.xp)+'</td>';
}

function rowHtml6(r){
  return '<tr>'+
    '<td class="wrap-cell">'+(esc6(r.s)||'<em>(blank)</em>')+'</td>'+
    slotCells(r.l[0], false, 0)+
    slotCells(r.l[1], false, 0)+
    slotCells(r.l[2], true, r.ex)+
    '<td><span class="req6-badge '+(r.d?'r6-dup-yes':'r6-dup-no')+'">'+(r.d?'Yes':'No')+'</span></td>'+
    '<td class="num">'+r.dc+'</td>'+
    '<td><span class="req6-badge '+(r.pm?'r6-mismatch-yes':'r6-mismatch-no')+'">'+(r.pm?'Yes':'No')+'</span></td>'+
    '<td>'+esc6(r.lc)+'</td>'+
  '</tr>';
}

function applySort6(){
  filtered6.sort((a,b)=>{
    let av, bv;
    if(sortKey6.indexOf('l')===0){
      var idx=parseInt(sortKey6[1],10), field=sortKey6.slice(2);
      av = a.l[idx] ? a.l[idx][field] : null;
      bv = b.l[idx] ? b.l[idx][field] : null;
    } else {
      av=a[sortKey6]; bv=b[sortKey6];
    }
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
  pageInfo6.textContent=`Showing ${shownFrom.toLocaleString()}\\u2013${shownTo.toLocaleString()} of ${filtered6.length.toLocaleString()} SKU rows`;
  prevBtn6.disabled=page6<=0;
  nextBtn6.disabled=start+PAGE_SIZE6>=filtered6.length;
}

function applyFilter6(){
  const s=q6.value.trim().toLowerCase();
  const dv=dupsel6.value, mv=mismatchsel6.value, sv=statussel6.value;
  filtered6=ROWS6.filter(r=>{
    const textHit=!s||r._blob.includes(s);
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

document.querySelectorAll('#reqsix-table th[data-k]').forEach(function(th){
  th.addEventListener('click',function(){
    const k=th.getAttribute('data-k');
    if(sortKey6===k) sortDir6=-sortDir6; else { sortKey6=k; sortDir6=1; }
    applySort6(); render6();
  });
});

applySort6();
render6();
"""
JS = JS.replace("__ROWS6_JSON__", rows_json)

# ---- replace the old panel-6 content entirely ----
i = c.find('<div id="tab-panel-6" class="tab-panel">')
assert i != -1
j = c.find("<script>")
old_panel_and_prefix = c[i:j]
assert old_panel_and_prefix.rstrip().endswith("</div>\n\n</div>\n\n</div>")
new_c = c[:i] + PANEL_HTML + "\n\n</div>\n" + c[j:]

# ---- replace the old req6 IIFE with the new one ----
old_iife_start = new_c.find("(function(){\n\nconst ROWS6=")
assert old_iife_start != -1
old_iife_end = new_c.find("\n})();", old_iife_start) + len("\n})();")
new_c = new_c[:old_iife_start] + "(function(){\n" + JS + "\n})();" + new_c[old_iife_end:]

open(PATH, "w", encoding="utf-8").write(new_c)
print("written", len(new_c) // 1024, "KB")
print("KPIs -> unique_skus:", unique_skus, "duplicate_skus:", duplicate_skus, "rows_with_dup:", rows_with_dup,
      "price_mismatch_skus:", price_mismatch_skus, "blank_sku_rows:", blank_sku_rows)
