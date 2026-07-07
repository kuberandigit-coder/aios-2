PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
c = open(PATH, encoding="utf-8").read()

# ---- 1. Req4: remove "Medium Priority" KPI card ----
old_card = '  <div class="card"><div class="l">Medium Priority</div><div class="v">0</div></div>\n'
assert c.count(old_card) == 1, f"expected 1, found {c.count(old_card)}"
c = c.replace(old_card, "", 1)

# ---- 2. Req4: fix broken CSS selector (old ids -> renamed q4/collsel4) ----
old_css4 = "#q, #collq, #collsel{flex:1;min-width:220px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}"
new_css4 = "#q4, #collq, #collsel4{flex:1;min-width:220px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}"
assert c.count(old_css4) == 1
c = c.replace(old_css4, new_css4, 1)

# ---- 3. Req5: fix broken CSS selector (old ids -> renamed q5/collsel5) ----
old_css5 = "#q, #collsel, #actionsel{flex:1;min-width:200px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}"
new_css5 = "#q5, #collsel5, #actionsel{flex:1;min-width:200px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;}"
assert c.count(old_css5) == 1
c = c.replace(old_css5, new_css5, 1)

# ---- 4. Req5: remove the Missing Meta Title/Description toggle button block ----
old_toggle_block = '''<div class="toolbar" style="top:auto;">
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

'''
assert c.count(old_toggle_block) == 1
c = c.replace(old_toggle_block, "", 1)

# ---- 5. Req5 JS: remove now-dead element refs + wireToggle calls (buttons no longer exist) ----
old_refs = "const tmYes=document.getElementById('tm-yes'),tmNo=document.getElementById('tm-no'),tmAll=document.getElementById('tm-all');\nconst dmYes=document.getElementById('dm-yes'),dmNo=document.getElementById('dm-no'),dmAll=document.getElementById('dm-all');\n"
assert c.count(old_refs) == 1
c = c.replace(old_refs, "", 1)

old_wire_calls = "wireToggle(tmYes,tmNo,tmAll,(m)=>tmMode=m);\nwireToggle(dmYes,dmNo,dmAll,(m)=>dmMode=m);\n"
assert c.count(old_wire_calls) == 1
c = c.replace(old_wire_calls, "", 1)

old_wire_fn = """function wireToggle(yesBtn,noBtn,allBtn,setMode){
  yesBtn.addEventListener('click',()=>{setMode('yes');[yesBtn,noBtn,allBtn].forEach(b=>b.classList.remove('on'));yesBtn.classList.add('on');applyFilter();});
  noBtn.addEventListener('click',()=>{setMode('no');[yesBtn,noBtn,allBtn].forEach(b=>b.classList.remove('on'));noBtn.classList.add('on');applyFilter();});
  allBtn.addEventListener('click',()=>{setMode('all');[yesBtn,noBtn,allBtn].forEach(b=>b.classList.remove('on'));allBtn.classList.add('on');applyFilter();});
}
"""
assert c.count(old_wire_fn) == 1
c = c.replace(old_wire_fn, "", 1)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
