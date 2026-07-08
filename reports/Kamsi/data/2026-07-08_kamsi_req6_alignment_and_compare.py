import json

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
FULL_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req6_pivot_rows_full.json"

c = open(PATH, encoding="utf-8").read()
full_rows = json.load(open(FULL_PATH, encoding="utf-8"))

# ---- 1. fix CSS specificity so Current/Compare Price columns are reliably right-aligned ----
old_css = "table.r6t th{text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#42506a;border-bottom:2px solid var(--line);background:#fafbfd;white-space:nowrap;cursor:pointer;}"
assert c.count(old_css) == 1
new_css = old_css + "\ntable.r6t th.num, table.r6t td.num{text-align:right !important;}"
c = c.replace(old_css, new_css, 1)

# ---- 2. rebuild ROWS6 to include xp (Compare Price) for the main row ----
rows_data = []
for r in full_rows:
    listings = r["listings"]
    main = listings[0]
    rows_data.append({
        "s": r["sku"], "u": main["url"], "cp": main["cp"], "xp": main["xp"],
        "all": [{"u": L["url"], "cp": L["cp"], "xp": L["xp"]} for L in listings],
        "d": r["duplicate"], "dc": r["duplicate_count"], "pm": r["price_mismatch"],
        "st": r["status"], "lc": r["last_checked"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

idx = c.find("const ROWS6=")
start = idx + len("const ROWS6=")
end = c.find(";\nconst PAGE_SIZE6", idx)
assert end != -1
c = c[:start] + rows_json + c[end:]

# ---- 3. add Compare Price header, right after Current Price ----
old_thead = '''<thead><tr>
    <th data-k="s">SKU</th>
    <th data-k="u">Listing URL</th>
    <th data-k="cp" class="num">Current Price (&pound;)</th>
    <th data-k="d">Duplicate?</th>
  </tr></thead>'''
assert c.count(old_thead) == 1
new_thead = '''<thead><tr>
    <th data-k="s">SKU</th>
    <th data-k="u">Listing URL</th>
    <th data-k="cp" class="num">Current Price (&pound;)</th>
    <th data-k="xp" class="num">Compare Price (&pound;)</th>
    <th data-k="d">Duplicate?</th>
  </tr></thead>'''
c = c.replace(old_thead, new_thead, 1)

# ---- 4. add Compare Price cell to the main row, and rebuild the dropdown as a proper mini-table ----
old_rowhtml = """function rowHtml6(r){
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
}"""
assert c.count(old_rowhtml) == 1
new_rowhtml = """function rowHtml6(r){
  var dupCell = r.d ? ('<span class="req6-badge r6-dup-yes">Yes ('+r.dc+')</span>') : '<span class="req6-badge r6-dup-no">No</span>';
  var clickable = r.d ? ' class="r6-clickable-row" data-sku="'+esc6(r.s)+'"' : '';
  var mainRow = '<tr'+clickable+'>'+
    '<td class="wrap-cell">'+(esc6(r.s)||'<em>(blank)</em>')+'</td>'+
    '<td class="wrap-cell"><a href="https://ledsone.co.uk'+esc6(r.u)+'" target="_blank" rel="noopener">'+esc6(r.u)+'</a></td>'+
    '<td class="num">'+gbp6(r.cp)+'</td>'+
    '<td class="num">'+gbp6(r.xp)+'</td>'+
    '<td>'+dupCell+'</td>'+
  '</tr>';
  if(r.d && openRows6.has(r.s)){
    var detailRows = r.all.map(function(L){
      return '<tr>'+
        '<td style="padding:6px 10px;border-bottom:1px solid #eef1f6;text-align:left;"><a href="https://ledsone.co.uk'+esc6(L.u)+'" target="_blank" rel="noopener">'+esc6(L.u)+'</a></td>'+
        '<td style="padding:6px 10px;border-bottom:1px solid #eef1f6;text-align:right;">'+gbp6(L.cp)+'</td>'+
        '<td style="padding:6px 10px;border-bottom:1px solid #eef1f6;text-align:right;">'+gbp6(L.xp)+'</td>'+
      '</tr>';
    }).join('');
    mainRow += '<tr class="r6-detail-row"><td colspan="5" style="background:#fafbfd;padding:12px 16px;">'+
      '<strong style="font-size:11px;text-transform:uppercase;color:#42506a;letter-spacing:.4px;">All '+r.dc+' listings for SKU '+esc6(r.s)+
      (r.pm ? ' <span class="req6-badge r6-mismatch-yes" style="margin-left:8px;">Price Mismatch</span>' : '') +
      '</strong>'+
      '<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px;">'+
        '<thead><tr>'+
          '<th style="text-align:left;padding:6px 10px;color:#42506a;font-weight:700;border-bottom:1px solid var(--line);">Listing URL</th>'+
          '<th style="text-align:right;padding:6px 10px;color:#42506a;font-weight:700;border-bottom:1px solid var(--line);">Current Price (&pound;)</th>'+
          '<th style="text-align:right;padding:6px 10px;color:#42506a;font-weight:700;border-bottom:1px solid var(--line);">Compare Price (&pound;)</th>'+
        '</tr></thead>'+
        '<tbody>'+detailRows+'</tbody>'+
      '</table>'+
    '</td></tr>';
  }
  return mainRow;
}"""
c = c.replace(old_rowhtml, new_rowhtml, 1)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
