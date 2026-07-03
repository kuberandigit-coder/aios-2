# Kamsi Requirement 1 — Slow-Moving Product Visibility — page builder (single source of truth)
# Merges: FULL Shopify catalog (bulk export JSONL, all products+variants, Shopify connector-sourced)
#         + PostgreSQL: Shopify-channel units sold 90d + last order date (public.order_transaction)
#         + PostgreSQL: current stock summed across warehouses (public.inv_final_stock)
# Rule (from requirement, verbatim): Units Sold (90d) < 10 AND Current Stock > 100 => Slow-Moving, else Active.
# Seasonal Tag: no reliable seasonal field exists (Shopify tags are promo campaign tags) => "Not Available".
import csv, html, os, json
from collections import OrderedDict

DATA = os.path.dirname(os.path.abspath(__file__))
GEN = "2026-07-03"
WINDOW = "2026-04-04 → 2026-07-03 (90 days)"

def p(*a): return os.path.abspath(os.path.join(*a))

orders = {}
for r in csv.DictReader(open(p(DATA, "2026-07-03_kamsi_req1_shopify_orders_90d.csv"), encoding="utf-8")):
    if r["sku"]: orders[r["sku"]] = (int(r["units_sold_90d"]), r["last_order_date"])

stock = {}
for r in csv.DictReader(open(p(DATA, "2026-07-03_kamsi_req1_stock_by_sku.csv"), encoding="utf-8")):
    stock[r["sku"]] = int(r["stock"])

# Full-store catalog from Shopify bulk export (JSONL: product lines then variant lines with __parentId)
products = {}
catalog = OrderedDict()  # sku -> row (first ACTIVE occurrence wins)
n_draft = 0
with open(p(DATA, "2026-07-03_kamsi_req1_full_catalog.jsonl"), encoding="utf-8") as f:
    for line in f:
        o = json.loads(line)
        if "__parentId" not in o:
            products[o["id"]] = o
        else:
            prod = products.get(o["__parentId"], {})
            sku = (o.get("sku") or "").strip()
            if not sku: continue
            if prod.get("status") != "ACTIVE":
                n_draft += 1; continue
            if sku in catalog: continue
            cat = " ".join((prod.get("productType") or "").replace("_", " ").split()).title() or "Uncategorised"
            catalog[sku] = {
                "sku": sku, "title": prod.get("title") or prod.get("handle", "").replace("-", " "),
                "pid": prod.get("id", ""), "category": cat,
                "handle": prod.get("handle", ""),
            }

rows = []
for sku, c in catalog.items():
    u, lo = orders.get(sku, (0, "—"))
    st = stock.get(sku)
    stock_known = st is not None
    stv = st if stock_known else 0
    status = "Slow-Moving" if (u < 10 and stock_known and stv > 100) else "Active"
    rows.append({**c, "units": u, "last_order": lo,
                 "stock": stv if stock_known else "—", "stock_known": stock_known,
                 "seasonal": "Not Available", "status": status})

rows.sort(key=lambda r: (0 if r["status"] == "Slow-Moving" else 1, -(r["stock"] if isinstance(r["stock"], int) else 0)))

n_slow = sum(1 for r in rows if r["status"] == "Slow-Moving")
n_active = len(rows) - n_slow
slow_stock = sum(r["stock"] for r in rows if r["status"] == "Slow-Moving" and isinstance(r["stock"], int))
n_nostock = sum(1 for r in rows if not r["stock_known"])
cats = sorted(set(r["category"] for r in rows))

def fmt(n): return f"{n:,}"

body = []
for r in rows:
    url = f"https://ledsone.co.uk/products/{r['handle']}" if r["handle"] else ""
    urlcell = (f'<a class="path" href="{url}" target="_blank" rel="noopener">/products/{r["handle"]}</a>'
               if r["handle"] else '<span class="na">—</span>')
    scls = "pill slow" if r["status"] == "Slow-Moving" else "pill act"
    stock_disp = fmt(r["stock"]) if isinstance(r["stock"], int) else "—"
    stock_note = "" if r["stock_known"] else '<div class="why">SKU not found in inventory system</div>'
    u_cls = "sess zero" if r["units"] == 0 else "sess"
    body.append(f'''        <tr data-status="{r["status"]}" data-cat="{r["category"]}" data-seas="{r["seasonal"]}">
          <td class="skucell">{html.escape(r["sku"])}</td>
          <td class="lp">{urlcell}<div class="why">{html.escape(r["title"][:90])}</div></td>
          <td>{html.escape(r["category"])}</td>
          <td class="num"><span class="{u_cls}">{fmt(r["units"])}</span></td>
          <td class="num"><span class="sess">{stock_disp}</span>{stock_note}</td>
          <td>{r["last_order"]}</td>
          <td class="na">{r["seasonal"]}</td>
          <td><span class="{scls}">{r["status"]}</span></td>
        </tr>''')

cat_opts = "\n".join(f'        <option value="{html.escape(c)}">{html.escape(c)}</option>' for c in cats)

page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Slow-Moving Product Visibility | Kamsi | LEDSone UK</title>
<style>
  :root{{
    --ink:#1a2233; --muted:#5b6577; --line:#e3e7ee; --bg:#f5f7fa;
    --card:#ffffff; --accent:#1f5eff; --accent-soft:#eaf0ff;
    --na:#9aa3b2; --good:#0a7d4f; --bad:#c62828;
  }}
  *{{box-sizing:border-box; margin:0; padding:0;}}
  body{{font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif; background:var(--bg); color:var(--ink); padding:32px 20px;}}
  .wrap{{max-width:1400px; margin:0 auto;}}
  header{{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:26px 30px; margin-bottom:18px;}}
  h1{{font-size:22px; letter-spacing:.2px;}}
  .sub{{color:var(--muted); font-size:13.5px; margin-top:6px;}}
  .filters{{display:flex; flex-wrap:wrap; gap:10px; margin-top:16px;}}
  .chip{{background:var(--accent-soft); color:var(--accent); border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:600;}}
  .cards{{display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:18px;}}
  .card{{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px;}}
  .card .label{{font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.6px;}}
  .card .value{{font-size:24px; font-weight:700; margin-top:6px;}}
  .card .note{{font-size:11.5px; color:var(--muted); margin-top:4px;}}
  .card.warn .value{{color:var(--bad);}}
  .tablebox{{background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden;}}
  .tablebox .tbar{{padding:14px 20px; border-bottom:1px solid var(--line); font-size:13px; color:var(--muted); display:flex; flex-wrap:wrap; gap:12px; align-items:center;}}
  .tbar input{{flex:1; min-width:220px; padding:8px 14px; border:1px solid var(--line); border-radius:8px; font-size:13px;}}
  .tbar label{{display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:#42506a;}}
  .tbar select{{padding:7px 10px; border:1px solid var(--line); border-radius:8px; font-size:12.5px; background:#fff; color:var(--ink); cursor:pointer;}}
  .tbar button{{padding:7px 16px; border:1px solid var(--line); border-radius:8px; background:#fff; cursor:pointer; font-size:12.5px;}}
  .tbar button.primary{{background:var(--accent); color:#fff; border-color:var(--accent);}}
  .scroll{{overflow-x:auto;}}
  table{{width:100%; border-collapse:collapse; font-size:13px; min-width:1100px; table-layout:fixed;}}
  col.c-sku{{width:11%;}} col.c-url{{width:26%;}} col.c-cat{{width:11%;}} col.c-units{{width:9%;}} col.c-stock{{width:9%;}} col.c-last{{width:10%;}} col.c-seas{{width:10%;}} col.c-status{{width:11%;}}
  thead th{{background:#f0f3f8; text-align:left; padding:12px 14px; font-size:11.5px; text-transform:uppercase; letter-spacing:.5px; color:#42506a; border-bottom:2px solid var(--line); cursor:pointer; user-select:none;}}
  thead th.num, td.num{{text-align:right;}}
  tbody td{{padding:11px 14px; border-bottom:1px solid var(--line); vertical-align:top; line-height:1.45; overflow-wrap:break-word;}}
  tbody tr:nth-child(even){{background:#fafbfd;}}
  tbody tr:hover{{background:var(--accent-soft);}}
  td.skucell{{font-family:Consolas,"Courier New",monospace; font-size:12px; font-weight:600;}}
  td.lp .path{{font-family:Consolas,"Courier New",monospace; font-size:11.5px; color:var(--accent); background:var(--accent-soft); border-radius:6px; padding:2px 8px; display:inline-block; max-width:100%; overflow-wrap:anywhere; text-decoration:none;}}
  td.na, .na{{color:var(--na); font-style:italic;}}
  .pill{{display:inline-block; border-radius:999px; padding:3px 11px; font-size:11.5px; font-weight:700; white-space:nowrap; color:#fff;}}
  .pill.slow{{background:#c62828;}}
  .pill.act{{background:#2e7d32;}}
  .sess{{font-weight:700; font-size:13.5px;}}
  .sess.zero{{color:var(--na); font-weight:600;}}
  .why{{font-size:11px; color:var(--muted); margin-top:4px; line-height:1.5;}}
  .footnotes{{margin-top:18px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px 24px; font-size:12.5px; color:var(--muted); line-height:1.65;}}
  .footnotes h3{{font-size:13px; color:var(--ink); margin-bottom:8px;}}
  .footnotes strong{{color:var(--ink);}}
  @media (max-width:700px){{ h1{{font-size:18px;}} .card .value{{font-size:19px;}} body{{padding:16px 8px;}} header{{padding:18px 16px;}} }}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Kamsi — Requirement 1</div>
    <h1>Slow-Moving Product Visibility</h1>
    <div class="sub">Which products have low sales but high current stock and need SEO/product visibility attention? &nbsp;·&nbsp; Website: <strong>https://ledsone.co.uk/</strong> &nbsp;·&nbsp; Requested by: <strong>Kamsi</strong> &nbsp;·&nbsp; Last updated: <strong>{GEN}</strong></div>
    <div class="filters">
      <span class="chip">Sales window: {WINDOW}</span>
      <span class="chip">Rule: Units Sold (90d) &lt; 10 AND Current Stock &gt; 100 → Slow-Moving</span>
      <span class="chip">Sources: Shopify catalog · Shopify-channel order lines (PostgreSQL mirror) · Warehouse inventory (PostgreSQL)</span>
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="label">Total Products Checked</div><div class="value">{fmt(len(rows))}</div><div class="note">full store catalog, active SKUs</div></div>
    <div class="card warn"><div class="label">Slow-Moving Products</div><div class="value">{fmt(n_slow)}</div><div class="note">&lt;10 sold (90d) &amp; stock &gt;100</div></div>
    <div class="card"><div class="label">Active Products</div><div class="value">{fmt(n_active)}</div><div class="note">everything else</div></div>
    <div class="card warn"><div class="label">Stock in Slow-Moving</div><div class="value">{fmt(slow_stock)}</div><div class="note">total units sitting in slow-movers</div></div>
  </div>

  <div class="tablebox">
    <div class="tbar"><span id="cnt">All {fmt(len(rows))} products</span>
      <input type="text" id="q" placeholder="Search SKU, URL or title…" oninput="flt()"></div>
    <div class="tbar" style="border-top:0;">
      <label>Status <select id="f_status" onchange="flt()">
        <option value="">All</option><option value="Slow-Moving">Slow-Moving</option><option value="Active">Active</option></select></label>
      <label>Category <select id="f_cat" onchange="flt()">
        <option value="">All</option>
{cat_opts}
      </select></label>
      <label>Seasonal Tag <select id="f_seas" onchange="flt()">
        <option value="">All</option><option value="Not Available">Not Available</option></select></label>
      <button onclick="rst()">Reset filters</button>
      <button class="primary" onclick="exp()">Export CSV</button>
    </div>
    <div class="scroll">
    <table id="t">
      <colgroup><col class="c-sku"><col class="c-url"><col class="c-cat"><col class="c-units"><col class="c-stock"><col class="c-last"><col class="c-seas"><col class="c-status"></colgroup>
      <thead>
        <tr>
          <th onclick="srt(0,false)">SKU</th>
          <th onclick="srt(1,false)">Page URL</th>
          <th onclick="srt(2,false)">Category</th>
          <th class="num" onclick="srt(3,true)">Units Sold (90d)</th>
          <th class="num" onclick="srt(4,true)">Current Stock</th>
          <th onclick="srt(5,false)">Last Order Date</th>
          <th onclick="srt(6,false)">Seasonal Tag</th>
          <th onclick="srt(7,false)">Status</th>
        </tr>
      </thead>
      <tbody>
{chr(10).join(body)}
      </tbody>
    </table>
    </div>
  </div>

  <div class="footnotes">
    <h3>Notes &amp; Methodology</h3>
    <strong>Product list:</strong> {fmt(len(rows))} active SKUs — the FULL Shopify Admin catalog (every product and variant), exported via a Shopify bulk operation on {GEN} through the Shopify connector (read-only). Category = Shopify product type (lightly normalised for case/underscores). Non-ACTIVE (draft/archived) variants excluded ({fmt(n_draft)} rows) because their pages are not publicly visible.<br>
    <strong>Units Sold (90d) &amp; Last Order Date:</strong> Shopify-channel order lines from the company PostgreSQL order mirror (public.order_transaction, source SHOPIFY, cancelled orders excluded), window {WINDOW}, read-only. SKUs with no Shopify order in the window show 0 and "—".<br>
    <strong>Current Stock:</strong> company inventory system (PostgreSQL public.inv_final_stock), stock summed across all warehouses, read-only, snapshot {GEN}. Cross-verified against the live Shopify Admin on {GEN}: Shopify's sellable quantity runs slightly lower than the warehouse total (samples: 613 vs 656, 121 vs 154) because Shopify shows channel-allocated stock — the warehouse total is used here as the true "current stock". {fmt(n_nostock)} SKUs not present in the inventory system show "—" and are never classified Slow-Moving (stock unknown ≠ stock &gt; 100).<br>
    <strong>Status rule (verbatim from requirement):</strong> Units Sold (90d) &lt; 10 AND Current Stock &gt; 100 → <span class="pill slow">Slow-Moving</span>, otherwise <span class="pill act">Active</span>.<br>
    <strong>Seasonal Tag:</strong> "Not Available" — Shopify product tags were inspected via the connector and contain only promotional campaign tags (e.g. "xmas", "Christmas Biggest Sale" on non-seasonal items like ceiling hooks), which do not reliably indicate product seasonality; no seasonal metafield/product type exists. Per requirement, no seasonal tags were invented.<br>
    <strong>Data files:</strong> <code>reports/Kamsi/data/2026-07-03_kamsi_req1_*.csv</code> · Builder: <code>2026-07-03_kamsi_req1_page_builder.py</code> (rerun to regenerate).
  </div>

</div>
<script>
function vis(){{return [].slice.call(document.querySelectorAll('#t tbody tr')).filter(function(tr){{return tr.style.display!=='none';}});}}
function flt(){{
  var q=document.getElementById('q').value.toLowerCase();
  var fs=document.getElementById('f_status').value, fc=document.getElementById('f_cat').value, fz=document.getElementById('f_seas').value;
  var shown=0, total=0;
  document.querySelectorAll('#t tbody tr').forEach(function(tr){{
    total++;
    var ok = tr.cells[0].innerText.toLowerCase().indexOf(q)>-1 || tr.cells[1].innerText.toLowerCase().indexOf(q)>-1;
    if(ok && fs) ok = tr.dataset.status===fs;
    if(ok && fc) ok = tr.dataset.cat===fc;
    if(ok && fz) ok = tr.dataset.seas===fz;
    tr.style.display = ok ? '' : 'none';
    if(ok) shown++;
  }});
  document.getElementById('cnt').textContent = shown===total ? 'All '+total.toLocaleString()+' products' : 'Showing '+shown.toLocaleString()+' of '+total.toLocaleString()+' products';
}}
function rst(){{
  ['f_status','f_cat','f_seas'].forEach(function(i){{document.getElementById(i).value='';}});
  document.getElementById('q').value=''; flt();
}}
var dir={{}};
function srt(i,num){{
  var tb=document.querySelector('#t tbody'), rows=[].slice.call(tb.rows);
  dir[i]=!dir[i];
  rows.sort(function(a,b){{
    var x=a.cells[i].innerText.trim(), y=b.cells[i].innerText.trim();
    if(num){{x=parseFloat(x.replace(/,/g,''))||0; y=parseFloat(y.replace(/,/g,''))||0; return dir[i]?y-x:x-y;}}
    return dir[i]?y.localeCompare(x):x.localeCompare(y);
  }});
  rows.forEach(function(r){{tb.appendChild(r);}});
}}
function exp(){{
  var hdr=['SKU','Page URL','Category','Units Sold (90d)','Current Stock','Last Order Date','Seasonal Tag','Status'];
  var lines=[hdr.join(',')];
  vis().forEach(function(tr){{
    var url=tr.cells[1].querySelector('a'); url=url?url.href:'';
    var vals=[tr.cells[0].innerText.trim(), url, tr.dataset.cat,
      tr.cells[3].innerText.trim().replace(/,/g,''), tr.cells[4].innerText.trim().split('\\n')[0].replace(/,/g,''),
      tr.cells[5].innerText.trim(), tr.dataset.seas, tr.dataset.status];
    lines.push(vals.map(function(v){{return '"'+String(v).replace(/"/g,'""')+'"';}}).join(','));
  }});
  var blob=new Blob([lines.join('\\n')],{{type:'text/csv'}});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='kamsi-slow-moving-products-{GEN}.csv'; a.click();
}}
</script>
</body>
</html>
'''

out1 = p(DATA, "..", "..", "digital-marketing-member-pages", "pages", "kamsi-req1-slow-moving-products.html")
out2 = p(DATA, "..", "kamsi-requirement-1-slow-moving-products.html")
for o in (out1, out2):
    with open(o, "w", encoding="utf-8", newline="\n") as f: f.write(page)
    print("wrote", o)
print(f"products={len(rows)} slow={n_slow} active={n_active} slow_stock={slow_stock} stock_unknown={n_nostock}")
