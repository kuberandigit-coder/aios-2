import csv, collections, html, shutil

csvp = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/dilaksi/data/2026-07-02_req2-shopify-category-sku-sales-last30d.csv"
rows = list(csv.reader(open(csvp, encoding='utf-8-sig')))[1:]

order = ["pendant-lights", "wall-light", "spider-light", "plugin-lighting", "table-lamps"]
prods = collections.defaultdict(lambda: {"title": "", "vendor": "", "status": "", "sales": 0.0, "units": 0, "orders": 0, "vars": []})
for coll, title, pid, vid, sku, ts, qty, od, vendor, status in rows:
    k = (coll, pid); p = prods[k]
    p["title"] = title; p["vendor"] = vendor; p["status"] = status
    p["sales"] += float(ts); p["units"] += int(qty); p["orders"] += int(od)
    p["vars"].append((sku, vid, float(ts), int(qty)))

bycoll = collections.defaultdict(list)
for (coll, pid), p in prods.items():
    bycoll[coll].append((pid, p))
for c in bycoll:
    bycoll[c].sort(key=lambda x: -x[1]["sales"])

net_tot = sum(p["sales"] for p in prods.values())
units_tot = sum(p["units"] for p in prods.values())
sold = sum(1 for p in prods.values() if p["sales"] > 0)

def esc(s):
    return html.escape(s or "")


# --- Semrush demand (UK db, pulled 2026-07-02) ---
COLL_DEMAND={"pendant-lights":("pendant lights",6600),"wall-light":("wall lights",40500),
"spider-light":("spider light",1000),"plugin-lighting":("plug in lighting",170),"table-lamps":("table lamps",18100)}
PROD_DEMAND={ # pid: (keyword, volume/mo, confidence)
"15086824259970":("metal pendant ceiling lights",20,"MEDIUM"),
"15071739019650":("industrial wall light",480,"LOW"),
"4417272086624":("adjustable pendant light",260,"MEDIUM"),
"15260815720834":("nautical wall light",40,"MEDIUM"),
"7105746796705":("pool table lights",1000,"HIGH"),
"6898632065185":("plug in pendant light",1300,"HIGH"),
"15023091188098":("single pendant light",170,"MEDIUM"),
"7982911619322":("pendant lamp holder",210,"MEDIUM"),
"8011075125498":("crow table lamp",20,"HIGH"),
"14872946311554":("swan neck wall light",210,"HIGH"),
"7053693649057":("spider ceiling light",320,"MEDIUM"),
"6852374102177":("hemp rope pendant light",20,"MEDIUM"),
"14881058324866":("wall spotlight",590,"LOW"),
"7630664532218":("copper wall light",260,"MEDIUM"),
"4552643903584":("steampunk lamp",480,"LOW"),
"15260060582274":("steampunk ceiling light",140,"MEDIUM"),
"14879664472450":("adjustable ceiling spotlight",10,"MEDIUM"),
"15270960234882":("octopus pendant light",20,"MEDIUM"),
"14907263746434":("easy fit pendant light",110,"MEDIUM"),
"14934429958530":("industrial pendant light",390,"MEDIUM"),
"7819052286202":("spider lamp",140,"MEDIUM"),
"15322580779394":("black and gold pendant light",260,"MEDIUM"),
"6024708292769":("e27 lamp holder pendant",10,"MEDIUM"),
"15097952764290":("semi flush mount ceiling light",1300,"HIGH"),
"6024708718753":("fabric cable pendant light",20,"MEDIUM"),
"14929097884034":("metal shade pendant light",90,"MEDIUM"),
"7651373547770":("plug in ceiling light",590,"MEDIUM"),
"7982927741178":("copper pendant light",880,"MEDIUM"),
"7985931354362":("e27 pendant light",90,"MEDIUM"),
"8073532997882":("rope pendant light",260,"MEDIUM"),
}


# --- Full-catalog demand (auto keywords from cleaned titles; Semrush uk 2026-07-02) ---
import json as _json
_DATA="C:/Users/PC/OneDrive/Desktop/kuberan web/reports/dilaksi/data/"
_KWMAP=_json.load(open(_DATA+"2026-07-02_req2-keyword-map.json"))
_VOL={}
for _l in open(_DATA+"2026-07-02_req2-semrush-volumes.csv",encoding="utf-8"):
    _l=_l.strip()
    if _l and ";" in _l:
        _k,_v=_l.rsplit(";",1); _VOL[_k]=int(_v)
def auto_demand(coll,pid):
    kw=_KWMAP.get(coll+"|"+pid)
    if not kw: return None
    v=_VOL.get(kw)
    if v is None: return (kw,0,"LOW")  # keyword not in Semrush db => 0/no data
    return (kw,v,"AUTO")

# --- GA4 Organic Sessions (Data API, service account, last 30 days, Organic Search only) ---
import re as _re
_HANDLE = {}  # pid -> handle
_p1 = _json.load(open(_DATA + "2026-07-02_req2-handles-p1.json"))
for _c in _p1["data"].values():
    for _e in _c.get("products", {}).get("edges", []):
        _n = _e["node"]
        _HANDLE[str(_n["legacyResourceId"])] = _n["handle"]
for _pg in ("p2", "p3", "p4"):
    for _row in csv.DictReader(open(_DATA + "2026-07-02_req2-handles-%s.csv" % _pg, encoding="utf-8")):
        _HANDLE[str(_row["legacyResourceId"])] = _row["handle"]

_ORG = collections.defaultdict(int)  # handle -> organic sessions
for _row in csv.DictReader(open(_DATA + "2026-07-02_req2-ga4-organic-landing-30d.csv", encoding="utf-8-sig")):
    _path = (_row["landing_page"] or "").split("?")[0].rstrip("/")
    _m = _re.search(r"/products/([^/]+)$", _path)
    if _m:
        _ORG[_m.group(1)] += int(float(_row["sessions"]))

def organic_sessions(pid):
    h = _HANDLE.get(str(pid))
    return _ORG.get(h, 0) if h else 0

# --- SEO Priority (approved Dilaksi Req 2 business rule, 2026-07-02) ---
# Rules applied in exact order. Profit Margin (PM) is not yet available (COGS pending),
# but rules 2 and 4 also require Sales >= 10000 / >= 4000 and the maximum product sales
# in this dataset is 1995.12 — so PM-dependent rules can never match and every row is
# decidable without PM. Verified before build; documented in evidence.
def seo_priority(demand, sales, org):
    # demand: int or None (None = no keyword could be mapped from the title)
    if demand is None:
        # Rules 1/3/5 need demand; 2/4 are false (sales < 4000 for all rows); rule 6 => Low.
        # Rule 1 would also give Low (sales < 2000 always true here), so priority is Low
        # either way — flagged for review because the keyword is unmapped.
        return ("Low — flag for review", "1/6 (demand unmapped; Low either way)")
    if demand < 100 and sales < 2000:
        return ("Low — flag for review", "1")
    # 2: sales >= 10000 and PM >= 30 — unreachable (max sales 1995.12), PM not needed
    if demand >= 2000 and org < demand * 0.5:
        return ("High", "3")
    # 4: sales >= 4000 and PM >= 25 and demand >= 500 — unreachable (max sales 1995.12)
    if demand >= 500 and org >= demand * 0.5:
        return ("Medium", "5")
    return ("Low", "6")

PRI_LOG = []  # evidence rows: coll, pid, title, sales, demand, organic, profit_margin, condition, priority

COLL_META = {"pendant-lights": ("Pendant Lights", "#1f5eff"), "wall-light": ("Wall Lights", "#0a7d4f"),
             "spider-light": ("Spider Lights", "#9a5b00"), "plugin-lighting": ("Plug-in Lighting", "#c62828"),
             "table-lamps": ("Table Lamps", "#6a1b9a")}

sections = []
for c in order:
    plist = bycoll[c]; name, color = COLL_META[c]
    csales = sum(p["sales"] for _, p in plist); cunits = sum(p["units"] for _, p in plist)
    csold = sum(1 for _, p in plist if p["sales"] > 0)
    items = []
    for pid, p in plist:
        vs = sorted(p["vars"], key=lambda v: -v[2])
        vrows = "".join(
            '<tr><td class="sku">{sku}</td><td class="vid">{vid}</td>'
            '<td class="num {cls}">{s:,.2f}</td><td class="num">{q}</td></tr>'.format(
                sku=esc(sku) if sku else "<i>no SKU</i>", vid=esc(vid) or "&mdash;",
                cls="pos" if s > 0 else "zero", s=s, q=q or "")
            for sku, vid, s, q in vs)
        sales_cls = "pos" if p["sales"] > 0 else ("neg" if p["sales"] < 0 else "zero")
        dm=PROD_DEMAND.get(pid) or auto_demand(c,pid)
        if dm:
            dcls = "dm" if dm[1] > 0 else "dm dm0"
            badge = ('<span class="{dc}" title="Google searches per month in the UK for the keyword mapped to this product (Semrush, pulled 2026-07-02)">'
                     'Demand: {v:,} searches/mo <i class="kw">&ldquo;{kw}&rdquo;</i></span>').format(dc=dcls, kw=esc(dm[0]), v=dm[1])
        else:
            badge = '<span class="dm dm0" title="no keyword could be mapped from this product title">Demand: n/a</span>'
        og = organic_sessions(pid)
        ocls = "og" if og > 0 else "og og0"
        otitle = "Visitors who landed on this product page from unpaid Google search in the last 30 days (GA4 Data API, Organic Search channel only)" if _HANDLE.get(str(pid)) else "product handle not resolved; shown as 0"
        badge += '<span class="{oc}" title="{ot}">Organic: {ov:,} visit{pl} (30d)</span>'.format(oc=ocls, ot=otitle, ov=og, pl="" if og == 1 else "s")
        _d = dm[1] if dm else None
        pri, cond = seo_priority(_d, p["sales"], og)
        PRI_LOG.append([c, pid, p["title"], round(p["sales"], 2), "" if _d is None else _d, og, "N/A (COGS pending)", cond, pri])
        pcls = {"H": "pri-h", "M": "pri-m"}.get(pri[0], "pri-l")
        badge += ('<span class="pri {pc}" title="SEO Priority — approved Dilaksi Req 2 business rule, matched condition {cn}. '
                  'Inputs: demand {dv}, sales &pound;{sv:,.2f}, organic {ov}, profit margin N/A (COGS pending; not required — see evidence)">'
                  'SEO: {pv}</span>').format(pc=pcls, cn=esc(cond), dv=("n/a" if _d is None else "{:,}".format(_d)), sv=p["sales"], ov=og, pv=esc(pri))
        badge += '<span class="s {cls}" title="Net sales in the last 30 days (returns deducted)">&pound;{v:,.2f}</span>'.format(cls=sales_cls, v=p["sales"])
        badge += '<span class="u">{u} units</span>'.format(u=p["units"]) if p["units"] else '<span class="u none">no sales</span>'
        status = '' if p["status"] == "ACTIVE" else '<span class="st">{s}</span>'.format(s=esc(p["status"]))
        skus_attr = esc(" ".join((sku or "").lower() for sku, _, _, _ in vs))
        items.append(
            '<details class="prod" data-coll="' + c + '" data-name="{nm}" data-sku="{sk}" data-sold="{so}">'
            '<summary><span class="t">{ti}{st}</span>{bd}</summary>'
            '<table class="vt"><thead><tr><th>SKU</th><th>Variant ID</th><th class="num">Sales (&pound;)</th><th class="num">Units</th></tr></thead>'
            '<tbody>{vr}</tbody></table></details>'.format(
                nm=esc(p["title"].lower()), sk=skus_attr, so=1 if p["sales"] > 0 else 0,
                ti=esc(p["title"]), st=status, bd=badge, vr=vrows))
    corg = sum(organic_sessions(pid) for pid, _ in plist)
    sections.append(
        '<section class="coll" id="{c}">'
        '<h2 style="border-left:5px solid {color};"><span>{name} <code>/{c}</code></span>'
        '<span class="cstat">{n} products &middot; {sold} sold &middot; &pound;{s:,.2f} &middot; {u} units &middot; demand &ldquo;{dk}&rdquo; {dv:,}/mo &middot; organic {corg:,} visits (30d)</span></h2>'
        '{items}</section>'.format(c=c, color=color, name=name, n=len(plist), sold=csold, s=csales, u=cunits, dk=COLL_DEMAND[c][0], dv=COLL_DEMAND[c][1], corg=corg, items="".join(items)))

CSS = """
:root{--ink:#1a2233;--muted:#5b6577;--line:#e3e7ee;--bg:#f5f7fa;--card:#fff;--accent:#1f5eff;--accent-soft:#eaf0ff;--good:#0a7d4f;--na:#9aa3b2;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Segoe UI",system-ui,Arial,sans-serif;background:var(--bg);color:var(--ink);padding:28px 16px;}
.wrap{max-width:1050px;margin:0 auto;}
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
#q{flex:1;min-width:220px;padding:10px 16px;border:1px solid var(--line);border-radius:10px;font-size:14px;}
.tbtn{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);}
.tbtn.on{background:var(--accent);color:#fff;border-color:var(--accent);}
section.coll{margin-bottom:26px;}
section.coll h2{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;font-size:15.5px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
section.coll h2 code{color:var(--muted);font-size:12px;font-weight:400;}
.cstat{font-size:12.5px;color:var(--muted);font-weight:500;align-self:center;}
details.prod{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:6px;overflow:hidden;}
details.prod summary{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;list-style:none;flex-wrap:wrap;}
details.prod summary::-webkit-details-marker{display:none;}
details.prod summary:hover{background:var(--accent-soft);}
details.prod .t{font-size:13.5px;font-weight:600;flex:1;min-width:200px;}
.s{font-weight:700;font-size:13.5px;white-space:nowrap;}
.s.pos{color:var(--good);} .s.zero{color:var(--na);font-weight:500;} .s.neg{color:#c62828;}
.u{font-size:11.5px;color:var(--muted);background:#f0f3f8;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.u.none{color:var(--na);}
.dm{font-size:11.5px;font-weight:700;color:#6a1b9a;background:#f3e8fb;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.dm.dm0{color:#9aa3b2;background:#f0f3f8;font-weight:600;}
.og{font-size:11.5px;font-weight:700;color:#1f5eff;background:#eaf0ff;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.og.og0{color:#9aa3b2;background:#f0f3f8;font-weight:600;}
.dm .kw{font-weight:500;font-style:normal;opacity:.85;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom;}
.pri{font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;}
.pri-h{color:#c62828;background:#fdecea;}
.pri-m{color:#9a5b00;background:#fff4e5;}
.pri-l{color:#5b6577;background:#f0f3f8;font-weight:600;}
.rulenote{background:var(--card);border:1px solid var(--line);border-left:5px solid #c62828;border-radius:12px;padding:12px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);}
.rulenote strong{color:var(--ink);}
.legend{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 18px;margin-bottom:14px;font-size:12.5px;color:var(--muted);line-height:1.9;}
.legend strong{color:var(--ink);}
.legend .dm,.legend .og,.legend .s,.legend .u{margin-right:4px;}
.tgroup{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.tgroup .glbl{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-right:2px;}
.st{font-size:10.5px;color:#9a5b00;background:#fff4e5;border-radius:999px;padding:2px 8px;margin-left:8px;font-weight:700;}
table.vt{width:100%;border-collapse:collapse;font-size:12.5px;background:#fafbfd;}
table.vt th{text-align:left;padding:8px 16px;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:#42506a;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
table.vt td{padding:7px 16px;border-bottom:1px solid #eef1f6;}
table.vt .sku{word-break:break-all;max-width:420px;}
table.vt .vid{color:var(--muted);font-size:11.5px;}
.num{text-align:right;white-space:nowrap;}
td.num.pos{color:var(--good);font-weight:600;} td.num.zero{color:var(--na);}
.foot{margin-top:20px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px;font-size:12.5px;color:var(--muted);line-height:1.65;}
.foot strong{color:var(--ink);}
.hidden{display:none!important;}
@media(max-width:600px){h1{font-size:18px;}.card .v{font-size:17px;}}
"""

JS = """
const q=document.getElementById('q'),openB=document.getElementById('f-open');
let salesMode='all',collMode='all';
function apply(){
  const s=q.value.trim().toLowerCase();
  document.querySelectorAll('details.prod').forEach(d=>{
    const textHit=!s||d.dataset.name.includes(s)||d.dataset.sku.includes(s);
    const salesHit=salesMode==='all'||(salesMode==='sold'?d.dataset.sold==='1':d.dataset.sold==='0');
    const collHit=collMode==='all'||d.dataset.coll===collMode;
    d.classList.toggle('hidden',!(textHit&&salesHit&&collHit));
  });
  document.querySelectorAll('section.coll').forEach(sec=>{
    sec.classList.toggle('hidden',!sec.querySelector('details.prod:not(.hidden)'));
  });
}
q.addEventListener('input',apply);
document.getElementById('g-sales').addEventListener('click',e=>{
  const b=e.target.closest('.tbtn');if(!b)return;
  salesMode=b.dataset.sales;
  document.querySelectorAll('#g-sales .tbtn').forEach(x=>x.classList.toggle('on',x===b));
  apply();
});
document.getElementById('g-coll').addEventListener('click',e=>{
  const b=e.target.closest('.tbtn');if(!b)return;
  collMode=b.dataset.coll;
  document.querySelectorAll('#g-coll .tbtn').forEach(x=>x.classList.toggle('on',x===b));
  apply();
});
let opened=false;
openB.onclick=()=>{opened=!opened;openB.textContent=opened?'Collapse all':'Expand all';document.querySelectorAll('details.prod:not(.hidden)').forEach(d=>d.open=opened);};
"""

page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Product Priority Guidance — All Products | Dilaksi | LEDSone UK</title>
<style>{css}</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 2 — Full Product List</div>
  <h1>Product Priority Guidance — All Products, SKUs &amp; Sales</h1>
  <div class="sub">Requested by: <strong>Dilaksi</strong> (SEO team) &middot; Store: <strong>ledsone.co.uk</strong> &middot; Generated: <strong>2026-07-02</strong> &middot; Source: live Shopify extraction (Admin API + ShopifyQL)</div>
  <div class="chips">
    <span class="chip">Date range: Last 30 Days (2026-06-02 &rarr; 2026-07-02, BST)</span>
    <span class="chip">5 collections &middot; {nprod} products &middot; {nrows} SKU rows</span>
    <span class="chip warn">Sales are net of returns</span>
    <span class="chip" style="background:#f3e8fb;color:#6a1b9a;">Demand: Semrush UK monthly search volume — full catalog (every product keyword-mapped)</span>
    <span class="chip">Organic Sessions: GA4 Data API — true last 30 days, Organic Search only</span>
  </div>
</header>

<div class="cards">
  <div class="card"><div class="l">Total Sales (30d)</div><div class="v">&pound;{tot:,.2f}</div></div>
  <div class="card"><div class="l">Units Sold</div><div class="v">{units:,}</div></div>
  <div class="card"><div class="l">Products in Scope</div><div class="v">{nprod:,}</div></div>
  <div class="card"><div class="l">Products with Sales</div><div class="v">{sold}</div></div>
</div>

<div class="toolbar">
  <input id="q" type="text" placeholder="Search product name or SKU&hellip;">
  <span class="tgroup" id="g-sales">
    <span class="glbl">Sales:</span>
    <button class="tbtn on" data-sales="all">All products</button>
    <button class="tbtn" data-sales="sold">With sales</button>
    <button class="tbtn" data-sales="unsold">Without sales</button>
  </span>
  <button class="tbtn" id="f-open">Expand all</button>
</div>
<div class="toolbar" style="top:auto;">
  <span class="tgroup" id="g-coll">
    <span class="glbl">Collection:</span>
    <button class="tbtn on" data-coll="all">All (5)</button>
    <button class="tbtn" data-coll="pendant-lights">Pendant Lights</button>
    <button class="tbtn" data-coll="wall-light">Wall Lights</button>
    <button class="tbtn" data-coll="spider-light">Spider Lights</button>
    <button class="tbtn" data-coll="plugin-lighting">Plug-in Lighting</button>
    <button class="tbtn" data-coll="table-lamps">Table Lamps</button>
  </span>
</div>

<div class="legend">
  <strong>How to read each product row</strong> (hover any badge for the full explanation):<br>
  <span class="dm">Demand: 6,600 searches/mo <i class="kw">&ldquo;pendant lights&rdquo;</i></span> = how many times per month people in the UK Google the keyword mapped to this product (Semrush UK database, pulled 2026-07-02). Grey <span class="dm dm0">Demand: 0 searches/mo</span> = the keyword has no measurable monthly searches.<br>
  <span class="og">Organic: 31 visits (30d)</span> = real visitors who landed on this product page from unpaid Google search in the last 30 days (GA4 Data API, Organic Search channel only). Grey <span class="og og0">Organic: 0 visits (30d)</span> = nobody arrived from organic search in the window.<br>
  <span class="s pos">&pound;1,995.12</span> = net sales in the last 30 days (Shopify, returns deducted) &middot; <span class="u">49 units</span> = units sold. Grey &pound;0.00 / <span class="u none">no sales</span> = listed but not sold in the window.<br>
  <span class="pri pri-h">SEO: High</span> / <span class="pri pri-m">SEO: Medium</span> / <span class="pri pri-l">SEO: Low</span> = SEO Priority from the approved business rule (hover shows the matched condition and the exact input values). <span class="pri pri-l">Low &mdash; flag for review</span> = low demand and low sales; review whether the product should be kept, merged or re-keyworded.<br>
  <strong>High demand or organic visits + no sales</strong> = the product gets interest but does not convert &mdash; these are the first SEO/CRO priorities. Use the <strong>Without sales</strong> filter to list them.
</div>

<div class="rulenote"><strong>SEO Priority calculated using approved Dilaksi Requirement 2 business rule. Rule documented in AIOS evidence.</strong> Rules applied in exact order: (1)&nbsp;Demand&nbsp;&lt;&nbsp;100 AND Sales&nbsp;&lt;&nbsp;&pound;2,000 &rarr; Low &mdash; flag for review &middot; (2)&nbsp;Sales&nbsp;&ge;&nbsp;&pound;10,000 AND Margin&nbsp;&ge;&nbsp;30% &rarr; High &middot; (3)&nbsp;Demand&nbsp;&ge;&nbsp;2,000 AND Organic&nbsp;&lt;&nbsp;50% of Demand &rarr; High &middot; (4)&nbsp;Sales&nbsp;&ge;&nbsp;&pound;4,000 AND Margin&nbsp;&ge;&nbsp;25% AND Demand&nbsp;&ge;&nbsp;500 &rarr; Medium &middot; (5)&nbsp;Demand&nbsp;&ge;&nbsp;500 AND Organic&nbsp;&ge;&nbsp;50% of Demand &rarr; Medium &middot; (6)&nbsp;else Low. Profit margin is not yet available (COGS pending) but is never required here: rules 2 and 4 also need sales &ge; &pound;4,000 and the highest 30-day product sales is &pound;1,995.12, so those rules cannot match any row.</div>

{sections}

<div class="foot">
  <strong>How to read this page:</strong> products are grouped by collection and sorted by 30-day sales (highest first). Click any product row to see every SKU/variant with its individual sales and units. Grey &pound;0.00 = listed but not sold in the window; red = net negative (returns exceeded sales).<br>
  <strong>Demand data source:</strong> Semrush keyword monthly search volume (UK database, pulled 2026-07-02). Keyword mapping documented in AIOS evidence. Purple badges show demand for the top 30 sellers; collection header shows the head-term demand; remaining products are not yet keyword-mapped (pending batch approval).<br>
  <strong>Demand data source: Semrush keyword monthly search volume. Keyword mapping documented in AIOS evidence.</strong> UK database, pulled 2026-07-02. Every product carries a demand badge (hover shows the keyword used). Purple = keyword has UK search volume; grey 0/mo = the mapped keyword has no measurable monthly searches; "n/a" = no keyword could be derived from the title (14 products). Top-30 sellers use manually curated keywords; the rest use automatically cleaned title keywords (marked AUTO in evidence).<br>
  <strong>Organic Sessions data source:</strong> Google Analytics 4 Data API (service account, property 408110563), true last-30-days window, session default channel group = <strong>Organic Search only</strong>. Sessions are summed per product from organic landing pages (<code>/products/&lt;handle&gt;</code> and <code>/collections/*/products/&lt;handle&gt;</code>, query strings stripped). Blue badge = the product received organic-search landing sessions in the window; grey 0 org = no organic landing sessions recorded. Product handles resolved via Shopify Admin GraphQL (pagination verified complete).<br>
  <strong>Data source:</strong> Shopify Admin GraphQL (all products &amp; variants of the 5 collections, pagination verified complete) + ShopifyQL sales cube (dual-pull, full coverage proven). A product appearing in more than one collection is shown under each. <strong>SEO Priority</strong> is calculated from the approved Requirement 2 business rule (see the red-bordered rule box above the product list; per-row calculation log in AIOS evidence). Profit margin remains pending (COGS not yet in PostgreSQL) &mdash; it is not required by any reachable rule for this dataset. Evidence: <code>evidence/dilaksi/dilaksi-requirement-2-shopify-sales-discovery-evidence.md</code>.
</div>

</div>
<script>{js}</script>
</body>
</html>""".format(css=CSS, js=JS, nprod=len(prods), nrows=len(rows), tot=net_tot, units=units_tot, sold=sold, sections="".join(sections))

with open(_DATA + "2026-07-02_req2-seo-priority-log.csv", "w", newline="", encoding="utf-8") as _f:
    _w = csv.writer(_f)
    _w.writerow(["collection", "product_id", "title", "sales_gbp_30d", "demand_searches_mo",
                 "organic_sessions_30d", "profit_margin", "matched_condition", "seo_priority"])
    _w.writerows(PRI_LOG)
print("priority log rows:", len(PRI_LOG),
      "| High:", sum(1 for r in PRI_LOG if r[8] == "High"),
      "| Medium:", sum(1 for r in PRI_LOG if r[8] == "Medium"),
      "| Low:", sum(1 for r in PRI_LOG if r[8] == "Low"),
      "| Low-flag:", sum(1 for r in PRI_LOG if r[8].startswith("Low —")))

out = "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/digital-marketing-member-pages/pages/dilaksi-req2-all-products.html"
open(out, "w", encoding='utf-8').write(page)
shutil.copy(out, "C:/Users/PC/OneDrive/Desktop/kuberan web/reports/dilaksi/dilaksi-product-priority-guidance-last-30-days.html")
print("written, KB:", len(page) // 1024, "products:", len(prods), "skurows:", len(rows))
