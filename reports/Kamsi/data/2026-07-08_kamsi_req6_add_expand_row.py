import json, re

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
FULL_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req6_pivot_rows_full.json"

c = open(PATH, encoding="utf-8").read()
full_rows = json.load(open(FULL_PATH, encoding="utf-8"))

# ---- 1. build the new ROWS6 dataset: first 3 slots (l) + full list (all) for expansion ----
rows_data = []
for r in full_rows:
    listings = r["listings"]
    slots = []
    for i in range(3):
        if i < len(listings):
            L = listings[i]
            slots.append({"u": L["url"], "cp": L["cp"], "xp": L["xp"]})
        else:
            slots.append(None)
    extra = max(0, len(listings) - 3)
    rows_data.append({
        "s": r["sku"], "l": slots, "ex": extra,
        "all": [{"u": L["url"], "cp": L["cp"], "xp": L["xp"]} for L in listings] if extra > 0 else None,
        "d": r["duplicate"], "dc": r["duplicate_count"], "pm": r["price_mismatch"],
        "st": r["status"], "lc": r["last_checked"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

# ---- 2. swap ROWS6 declaration ----
idx = c.find("const ROWS6=")
start = idx + len("const ROWS6=")
end = c.find(";\nconst PAGE_SIZE6", idx)
assert end != -1
c = c[:start] + rows_json + c[end:]

# ---- 3. update rowHtml6 to add a clickable "+N more" toggle and an expand detail row ----
old_slotcells = """function slotCells(slot, isLast, extra){
  if(!slot){
    return '<td>-</td><td class="num">-</td><td class="num">-</td>';
  }
  var urlCell = '<a href="https://ledsone.co.uk'+esc6(slot.u)+'" target="_blank" rel="noopener">'+esc6(slot.u)+'</a>';
  if(isLast && extra > 0){ urlCell += ' <em>(+' + extra + ' more)</em>'; }
  return '<td class="wrap-cell">'+urlCell+'</td><td class="num">'+gbp6(slot.cp)+'</td><td class="num">'+gbp6(slot.xp)+'</td>';
}"""
assert c.count(old_slotcells) == 1
new_slotcells = """function slotCells(slot, isLast, extra, sku){
  if(!slot){
    return '<td>-</td><td class="num">-</td><td class="num">-</td>';
  }
  var urlCell = '<a href="https://ledsone.co.uk'+esc6(slot.u)+'" target="_blank" rel="noopener">'+esc6(slot.u)+'</a>';
  if(isLast && extra > 0){
    urlCell += ' <button class="tbtn r6-expand-btn" data-sku="'+esc6(sku)+'" style="padding:2px 8px;font-size:11px;margin-left:6px;">+' + extra + ' more &#9662;</button>';
  }
  return '<td class="wrap-cell">'+urlCell+'</td><td class="num">'+gbp6(slot.cp)+'</td><td class="num">'+gbp6(slot.xp)+'</td>';
}"""
c = c.replace(old_slotcells, new_slotcells, 1)

old_rowhtml = """function rowHtml6(r){
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
}"""
assert c.count(old_rowhtml) == 1
new_rowhtml = """function rowHtml6(r){
  var mainRow = '<tr>'+
    '<td class="wrap-cell">'+(esc6(r.s)||'<em>(blank)</em>')+'</td>'+
    slotCells(r.l[0], false, 0, r.s)+
    slotCells(r.l[1], false, 0, r.s)+
    slotCells(r.l[2], true, r.ex, r.s)+
    '<td><span class="req6-badge '+(r.d?'r6-dup-yes':'r6-dup-no')+'">'+(r.d?'Yes':'No')+'</span></td>'+
    '<td class="num">'+r.dc+'</td>'+
    '<td><span class="req6-badge '+(r.pm?'r6-mismatch-yes':'r6-mismatch-no')+'">'+(r.pm?'Yes':'No')+'</span></td>'+
    '<td>'+esc6(r.lc)+'</td>'+
  '</tr>';
  if(r.ex > 0 && openRows6.has(r.s)){
    var extraListings = r.all.slice(3);
    var detailHtml = extraListings.map(function(L){
      var urlCell = '<a href="https://ledsone.co.uk'+esc6(L.u)+'" target="_blank" rel="noopener">'+esc6(L.u)+'</a>';
      return '<div style="display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #eef1f6;flex-wrap:wrap;">'+
        '<span style="flex:1;min-width:200px;">'+urlCell+'</span>'+
        '<span style="min-width:110px;">Current: '+gbp6(L.cp)+'</span>'+
        '<span style="min-width:110px;">Compare: '+gbp6(L.xp)+'</span>'+
      '</div>';
    }).join('');
    mainRow += '<tr class="r6-detail-row"><td colspan="14" style="background:#fafbfd;padding:10px 16px;">'+
      '<strong style="font-size:11px;text-transform:uppercase;color:#42506a;letter-spacing:.4px;">All '+r.dc+' listings for SKU '+esc6(r.s)+'</strong>'+
      '<div style="margin-top:6px;">'+detailHtml+'</div>'+
    '</td></tr>';
  }
  return mainRow;
}"""
c = c.replace(old_rowhtml, new_rowhtml, 1)

# ---- 4. add openRows6 state + click delegation + re-render on toggle ----
old_state = "let page6=0, filtered6=ROWS6, sortKey6='s', sortDir6=1;"
assert c.count(old_state) == 1
new_state = "let page6=0, filtered6=ROWS6, sortKey6='s', sortDir6=1;\nconst openRows6=new Set();"
c = c.replace(old_state, new_state, 1)

old_render_call = "tbody6.innerHTML=pageRows.map(rowHtml6).join('');"
assert c.count(old_render_call) == 1
new_render_call = """tbody6.innerHTML=pageRows.map(rowHtml6).join('');
  tbody6.querySelectorAll('.r6-expand-btn').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.preventDefault();
      var sku=btn.getAttribute('data-sku');
      if(openRows6.has(sku)) openRows6.delete(sku); else openRows6.add(sku);
      render6();
    });
  });"""
c = c.replace(old_render_call, new_render_call, 1)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
