import json

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
BY_DAY_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-07_kamsi_req2_daily_by_day.json"

c = open(PATH, encoding="utf-8").read()
by_day_json = open(BY_DAY_PATH, encoding="utf-8").read()

# backup before touching
open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-07_kamsi_req1req2req3req4req5_merged_backup.html", "w", encoding="utf-8").write(c)

# ---- 1. Add CSS for the calendar grid (scoped, added once in <head>) ----
css_marker = "<style>\n\n.tab-panel{display:none;}\n.tab-panel.active{display:block;}\n\n</style>\n</head>"
assert css_marker in c
calendar_css = """
<style>
.calgrid{display:grid;grid-template-columns:repeat(10,1fr);gap:6px;padding:14px 20px;border-bottom:1px solid var(--line);}
.daycell{padding:8px 4px;text-align:center;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:pointer;font-size:12.5px;font-weight:600;color:#42506a;user-select:none;}
.daycell.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.daycell:hover{background:var(--accent-soft);}
.daycell.full{grid-column:span 2;}
</style>
"""
c = c.replace(css_marker, calendar_css + css_marker, 1)

# ---- 2. Insert the day dataset as a JSON data-holder script tag right after the existing d2 tag ----
d2_marker = "</script>\n\n\n  <header>"
# locate precisely: find the closing of the <script id="d2" ...> tag inside panel-2
idx_d2_open = c.find('<script id="d2" type="application/json">')
assert idx_d2_open != -1
idx_d2_close = c.find("</script>", idx_d2_open) + len("</script>")
day_script_tag = '\n<script id="d2day" type="application/json">' + by_day_json + "</script>"
c = c[:idx_d2_close] + day_script_tag + c[idx_d2_close:]

# ---- 3. Insert the calendar day-picker HTML right after the existing search/count tbar in panel 2 ----
old_tbar = '''<div class="tbar"><span id="cnt2">All 1,385 pages</span>
      <input type="text" id="q2" placeholder="Search URL or keyword…" oninput="flt2()"></div>'''
assert old_tbar in c, "old tbar block not found"
calendar_html = '''<div class="tbar"><span id="cnt2">All 1,385 pages</span>
      <input type="text" id="q2" placeholder="Search URL or keyword…" oninput="flt2()"></div>
    <div class="tbar" style="border-top:0;">
      <span style="font-weight:600;color:#42506a;margin-right:8px;">Day filter (June 2026):</span>
      <span id="daylabel2" style="color:#5b6577;font-size:12.5px;">Full Month</span>
    </div>
    <div class="calgrid" id="calgrid2"></div>'''
c = c.replace(old_tbar, calendar_html, 1)

# ---- 4. Patch the req2 IIFE script: add DAY dataset parse, dayBase() function, and day-aware filtering ----
anchor_D = "var D=JSON.parse(document.getElementById('d2').textContent); // [path,type,kw,imp,clk,ctr,pos,low]"
assert anchor_D in c
day_setup = anchor_D + """
var DAY=JSON.parse(document.getElementById('d2day').textContent);
var curDay2='';
function dayBase(day){
  if(!day) return D;
  var rows=DAY[day]||[];
  var map={};
  rows.forEach(function(e){ map[e[0]]=e; });
  return D.map(function(r,i){
    var e=map[i];
    if(!e) return [r[0],r[1],r[2],0,0,0,r[6],0];
    var imp=e[1], clk=e[2], ctr=e[3], pos=e[4];
    var low = imp>0 ? (ctr<2?1:0) : 0;
    return [r[0],r[1],r[2],imp,clk,ctr,pos,low];
  });
}
function buildCalendar2(){
  var el=document.getElementById('calgrid2');
  var html='<div class="daycell full'+(curDay2===''?' on':'')+'" onclick="pickDay2(\\'\\')">Full Month</div>';
  for(var d=1; d<=30; d++){
    var ds='2026-06-'+(d<10?'0'+d:d);
    html += '<div class="daycell'+(curDay2===ds?' on':'')+'" onclick="pickDay2(\\''+ds+'\\')">'+d+'</div>';
  }
  el.innerHTML=html;
}
function pickDay2(day){
  curDay2=day;
  document.getElementById('daylabel2').textContent = day ? ('Jun '+parseInt(day.slice(8),10)+', 2026') : 'Full Month';
  buildCalendar2();
  flt();
}"""
c = c.replace(anchor_D, day_setup, 1)

# flt() must filter from dayBase(curDay2) instead of the raw D
old_flt_line = "  F=D.filter(function(r){"
new_flt_line = "  var base2=dayBase(curDay2);\n  F=base2.filter(function(r){"
assert old_flt_line in c
c = c.replace(old_flt_line, new_flt_line, 1)

# rst() must also reset curDay2 and rebuild calendar
old_rst = """function rst(){
  ['f_flag','f_type','f_ctr'].forEach(function(i){document.getElementById(i).value='';});
  document.getElementById('q2').value=''; sc=-1; F=D.slice(); pg=1; render();
}"""
assert old_rst in c
new_rst = """function rst(){
  ['f_flag','f_type','f_ctr'].forEach(function(i){document.getElementById(i).value='';});
  document.getElementById('q2').value=''; sc=-1; curDay2=''; document.getElementById('daylabel2').textContent='Full Month'; buildCalendar2(); F=D.slice(); pg=1; render();
}"""
c = c.replace(old_rst, new_rst, 1)

# call buildCalendar2() once at startup (right before existing render(); call in this IIFE)
old_render_call = "}\nrender();\nwindow.flt2=flt; window.rst2=rst; window.srt2=srt;"
assert old_render_call in c
new_render_call = "}\nbuildCalendar2();\nrender();\nwindow.flt2=flt; window.rst2=rst; window.srt2=srt;"
c = c.replace(old_render_call, new_render_call, 1)

# expose pickDay2 globally (called from inline onclick in dynamically generated calendar HTML)
old_expose = "window.flt2=flt; window.rst2=rst; window.srt2=srt; if(typeof exp==='function') window.exp2=exp;"
new_expose = old_expose + " window.pickDay2=pickDay2;"
assert old_expose in c
c = c.replace(old_expose, new_expose, 1)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
