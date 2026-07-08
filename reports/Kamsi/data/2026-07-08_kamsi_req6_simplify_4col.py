import json

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
FULL_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req6_pivot_rows_full.json"

c = open(PATH, encoding="utf-8").read()
full_rows = json.load(open(FULL_PATH, encoding="utf-8"))

# ---- 1. build the new ROWS6 dataset: main = first listing, all = full listings list ----
rows_data = []
for r in full_rows:
    listings = r["listings"]
    main = listings[0]
    rows_data.append({
        "s": r["sku"], "u": main["url"], "cp": main["cp"],
        "all": [{"u": L["url"], "cp": L["cp"], "xp": L["xp"]} for L in listings],
        "d": r["duplicate"], "dc": r["duplicate_count"], "pm": r["price_mismatch"],
        "st": r["status"], "lc": r["last_checked"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

PANEL_HTML = """<table class="r6t" id="reqsix-table">
  <thead><tr>
    <th data-k="s">SKU</th>
    <th data-k="u">Listing URL</th>
    <th data-k="cp" class="num">Current Price (&pound;)</th>
    <th data-k="d">Duplicate?</th>
  </tr></thead>
  <tbody id="tbody6"></tbody>
</table>"""

JS_INNER = """
const ROWS6=__ROWS6_JSON__;
const PAGE_SIZE6=100;
const q6=document.getElementById('q6'),dupsel6=document.getElementById('dupsel6'),mismatchsel6=document.getElementById('mismatchsel6'),statussel6=document.getElementById('statussel6');
const tbody6=document.getElementById('tbody6'),pageInfo6=document.getElementById('pageInfo6'),prevBtn6=document.getElementById('prevPage6'),nextBtn6=document.getElementById('nextPage6');
let page6=0, filtered6=ROWS6, sortKey6='s', sortDir6=1;
const openRows6=new Set();

for(const r of ROWS6){ r._blob=((r.s||'')+' '+(r.u||'')).toLowerCase(); }
function esc6(s){return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gbp6(v){ return v==null ? '-' : '£'+Number(v).toFixed(2); }

function rowHtml6(r){
  var dupCell = r.d ? ('<span class="req6-badge r6-dup-yes">Yes ('+r.dc+')</span>') : '<span class="req6-badge r6-dup-no">No</span>';
  var clickable = r.d ? ' class="r6-clickable-row" data-sku="'+esc6(r.s)+'"' : '';
  var mainRow = '<tr'+clickable+'>'+
    '<td class="wrap-cell">'+(esc6(r.s)||'<em>(blank)</em>')+'</td>'+
    '<td class="wrap-cell"><a href="https://ledsone.co.uk'+esc6(r.u)+'" target="_blank" rel="noopener">'+esc6(r.u)+'</a></td>'+
    '<td class="num">'+gbp6(r.cp)+'</td>'+
    '<td>'+dupCell+'</td>'+
  '</tr>';
  if(r.d && openRows6.has(r.s)){
    var detailHtml = r.all.map(function(L){
      var urlCell = '<a href="https://ledsone.co.uk'+esc6(L.u)+'" target="_blank" rel="noopener">'+esc6(L.u)+'</a>';
      return '<div style="display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #eef1f6;flex-wrap:wrap;">'+
        '<span style="flex:1;min-width:200px;">'+urlCell+'</span>'+
        '<span style="min-width:110px;">Current: '+gbp6(L.cp)+'</span>'+
        '<span style="min-width:110px;">Compare: '+gbp6(L.xp)+'</span>'+
      '</div>';
    }).join('');
    mainRow += '<tr class="r6-detail-row"><td colspan="4" style="background:#fafbfd;padding:10px 16px;">'+
      '<strong style="font-size:11px;text-transform:uppercase;color:#42506a;letter-spacing:.4px;">All '+r.dc+' listings for SKU '+esc6(r.s)+
      (r.pm ? ' <span class="req6-badge r6-mismatch-yes" style="margin-left:8px;">Price Mismatch</span>' : '') +
      '</strong>'+
      '<div style="margin-top:6px;">'+detailHtml+'</div>'+
    '</td></tr>';
  }
  return mainRow;
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
  tbody6.querySelectorAll('.r6-clickable-row').forEach(function(tr){
    tr.style.cursor='pointer';
    tr.addEventListener('click',function(){
      var sku=tr.getAttribute('data-sku');
      if(openRows6.has(sku)) openRows6.delete(sku); else openRows6.add(sku);
      render6();
    });
  });
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
JS_INNER = JS_INNER.replace("__ROWS6_JSON__", rows_json)

# ---- replace the whole <table class="r6t" id="reqsix-table">...</table> ----
i = c.find('<table class="r6t" id="reqsix-table">')
assert i != -1
j = c.find("</table>", i) + len("</table>")
c = c[:i] + PANEL_HTML + c[j:]

# ---- replace the entire req6 IIFE ----
idx = c.find("const ROWS6=")
start = c.rfind("(function(){", 0, idx)
end = c.find("\n})();", idx) + len("\n})();")
c = c[:start] + "(function(){\n" + JS_INNER + "\n})();" + c[end:]

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
