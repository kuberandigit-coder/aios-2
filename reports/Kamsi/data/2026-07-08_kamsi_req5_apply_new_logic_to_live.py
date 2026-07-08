import json, html, collections

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
ROWS_PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req5_rows_v2.json"

c = open(PATH, encoding="utf-8").read()
open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_before_req5_new_logic_backup.html", "w", encoding="utf-8").write(c)

rows = json.load(open(ROWS_PATH, encoding="utf-8"))


def esc(s):
    return html.escape(s or "")


total = len(rows)
missing_title_n = sum(1 for r in rows if r["meta_title_status"] == "Missing")
auto_title_n = sum(1 for r in rows if r["meta_title_status"] == "Auto-generated")
missing_desc_n = sum(1 for r in rows if r["meta_description_status"] == "Missing")
auto_desc_n = sum(1 for r in rows if r["meta_description_status"] == "Auto-generated")
ok_n = sum(1 for r in rows if r["action_needed"] == "OK")
last_updated = max((r["last_updated"] for r in rows if r["last_updated"]), default="")[:10]

action_counts = collections.Counter(r["action_needed"] for r in rows)
action_list = sorted(action_counts.items(), key=lambda x: -x[1])
action_options = "".join(
    '<option value="{h}">{name} ({n})</option>'.format(h=esc(a), name=esc(a), n=n) for a, n in action_list
)

# ---- 1. Replace ROWS declaration ----
rows_data = []
for r in rows:
    rows_data.append({
        "u": r["page_url"], "c": r["collection_type"], "t": r["product_title"],
        "d": r["product_description"][:400], "mt": r["meta_title"], "md": r["meta_description"],
        "tl": r["title_length"], "dl": r["description_length"], "lu": r["last_updated"],
        "a": r["action_needed"], "mts": r["meta_title_status"], "mds": r["meta_description_status"],
    })
rows_json = json.dumps(rows_data, separators=(",", ":"), ensure_ascii=False)
rows_json = rows_json.replace("</script", "<\\/script").replace("<!--", "<\\!--")

idx = c.find("function updateActionCounts")
start = c.rfind("const ROWS=", 0, idx)
end_rows = c.find(";\nconst PAGE_SIZE", start)
old_rows_decl = c[start:end_rows]
new_rows_decl = "const ROWS=" + rows_json
assert old_rows_decl.startswith("const ROWS=[{")
c = c[:start] + new_rows_decl + c[end_rows:]
print("ROWS replaced, new length:", len(new_rows_decl))

# ---- 2. Replace KPI cards ----
old_cards = '''<div class="cards">
  <div class="card"><div class="l">Total Products Checked</div><div class="v">5,179</div></div>
  <div class="card"><div class="l">Missing Meta Title</div><div class="v">854</div></div>
  <div class="card"><div class="l">Missing Meta Description</div><div class="v">1,415</div></div>
  <div class="card"><div class="l">Both Missing</div><div class="v">795</div></div>
  <div class="card"><div class="l">OK Products</div><div class="v">3,705</div></div>
</div>'''
assert c.count(old_cards) == 1
new_cards = '''<div class="cards">
  <div class="card"><div class="l">Total Products Checked</div><div class="v">{total:,}</div></div>
  <div class="card"><div class="l">Missing Meta Title</div><div class="v">{mt:,}</div></div>
  <div class="card"><div class="l">Auto-generated Meta Title</div><div class="v">{at:,}</div></div>
  <div class="card"><div class="l">Missing Meta Description</div><div class="v">{md:,}</div></div>
  <div class="card"><div class="l">Auto-generated Meta Description</div><div class="v">{ad:,}</div></div>
  <div class="card"><div class="l">OK Products</div><div class="v">{ok:,}</div></div>
</div>'''.format(total=total, mt=missing_title_n, at=auto_title_n, md=missing_desc_n, ad=auto_desc_n, ok=ok_n)
c = c.replace(old_cards, new_cards, 1)

# ---- 3. Replace actionsel options ----
idx2 = c.find('id="actionsel"')
old_action_start = c.rfind("<select ", 0, idx2)
old_action_end = c.find("</select>", idx2) + len("</select>")
old_action_block = c[old_action_start:old_action_end]
assert 'id="actionsel"' in old_action_block
new_action_block = '<select id="actionsel"><option value="all">All Action Needed</option>' + action_options + "</select>"
c = c[:old_action_start] + new_action_block + c[old_action_end:]

# ---- 4. Replace badgeClass() ----
old_badge = """function badgeClass(a){
  if(a==='OK') return 'b-ok';
  if(a==='Add Meta Title and Meta Description') return 'b-danger';
  return 'b-warn';
}"""
assert c.count(old_badge) == 1
new_badge = """function badgeClass(a){
  if(a==='OK') return 'b-ok';
  if(a==='Add Custom Meta Title and Meta Description') return 'b-danger';
  return 'b-warn';
}"""
c = c.replace(old_badge, new_badge, 1)

# ---- 5. Replace rowHtml() to show Meta Title/Description Status ----
old_rowhtml = '''function rowHtml(r){
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
}'''
assert c.count(old_rowhtml) == 1
new_rowhtml = '''function statusPillClass(s){
  if(s==='Custom') return 'b-ok';
  if(s==='Auto-generated') return 'b-warn';
  return 'b-danger';
}
function rowHtml(r){
  return `<details class="prod">
    <summary>
      <div class="rowmain">
        <span class="t" title="${esc(r.t)}">${esc(r.t)}</span>
        <span class="ct">${esc(r.c)}</span>
        <span class="lens">T:${r.tl} &middot; D:${r.dl}</span>
      </div>
      <span class="badge ${statusPillClass(r.mts)}" title="Meta Title Status">MT: ${esc(r.mts)}</span>
      <span class="badge ${statusPillClass(r.mds)}" title="Meta Description Status">MD: ${esc(r.mds)}</span>
      <span class="badge ${badgeClass(r.a)}">${esc(r.a)}</span>
      <span class="caret">&#9662; details</span>
    </summary>
    <div class="detail">
      <div class="row"><span class="k">Page URL</span><span class="v"><a href="https://ledsone.co.uk${esc(r.u)}" target="_blank" rel="noopener">${esc(r.u)}</a></span></div>
      <div class="row"><span class="k">Product Title</span><span class="v">${esc(r.t)}</span></div>
      <div class="row"><span class="k">Product Description</span><span class="v">${esc(r.d)||'<i>(none)</i>'}</span></div>
      <div class="row"><span class="k">Meta Title</span><span class="v">${esc(r.mt)||'<i>(none)</i>'} <em>(${esc(r.mts)})</em></span></div>
      <div class="row"><span class="k">Meta Description</span><span class="v">${esc(r.md)||'<i>(none)</i>'} <em>(${esc(r.mds)})</em></span></div>
      <div class="row"><span class="k">Last Updated</span><span class="v">${esc((r.lu||'').slice(0,10))||'<i>(none)</i>'}</span></div>
    </div>
  </details>`;
}'''
c = c.replace(old_rowhtml, new_rowhtml, 1)

# ---- 6. Update legend + foot text ----
old_legend = '''<div class="legend">
  <strong>Evidence note:</strong> Shopify auto-filled SEO metadata is treated as missing when it matches the product title or product description.<br>
  <strong>How Action Needed is decided:</strong> <span class="badge b-danger">Add Meta Title and Meta Description</span> both fields blank &middot; <span class="badge b-warn">Add Meta Title</span> / <span class="badge b-warn">Add Meta Description</span> one field blank &middot; <span class="badge b-warn">Rewrite Meta Title</span> / <span class="badge b-warn">Rewrite Meta Description</span> field is present but auto-generated (matches the product title/description) &middot; <span class="badge b-ok">OK</span> both manually written and distinct from the source text.<br>
  Each row shows Product Title, Collection Type, Title/Description character counts (T:/D:), and the Action Needed badge on one line &mdash; no horizontal scrolling. Click any row to expand the full Page URL, Product Description, Meta Title, Meta Description, and Last Updated date.
</div>'''
assert c.count(old_legend) == 1
new_legend = '''<div class="legend">
  <strong>Evidence note (updated 2026-07-08):</strong> Meta Title/Description are treated as Auto-generated not just on exact match, but also when the SEO field matches the product title/description after normalization AND after removing trailing SKU/code suffixes (e.g. &ldquo;~2801&rdquo;, &ldquo;-2801&rdquo;, &ldquo;|2801&rdquo;), when it's a truncated prefix of the product text, or when text similarity is &ge;90% with no added SEO wording (buy/shop/online/uk/sale/best/premium/led/lighting/lights/ledsone).<br>
  <strong>How Action Needed is decided:</strong> <span class="badge b-danger">Add Custom Meta Title and Meta Description</span> both Missing or Auto-generated &middot; <span class="badge b-warn">Add Custom Meta Title</span> / <span class="badge b-warn">Add Custom Meta Description</span> only one field Missing/Auto-generated &middot; <span class="badge b-ok">OK</span> both fields Custom (manually written, genuinely distinct from the source text).<br>
  Each row shows Product Title, Collection Type, Title/Description character counts (T:/D:), Meta Title Status (MT), Meta Description Status (MD), and the Action Needed badge on one line &mdash; no horizontal scrolling. Click any row to expand the full Page URL, Product Title, Product Description, Meta Title, Meta Description, and Last Updated date.
</div>'''
c = c.replace(old_legend, new_legend, 1)

old_foot_marker_start = "<strong>Detection logic:</strong> Meta Title is missing if the SEO title field is blank, or if it exactly matches the product title after normalizing (HTML stripped, whitespace collapsed, case-insensitive). Meta Description is missing if the SEO description field is blank, or if it exactly matches the product description (or the first 160 characters of it) after the same normalization.<br>"
assert c.count(old_foot_marker_start) == 1
new_foot = "<strong>Detection logic (v2, 2026-07-08):</strong> Meta Title Status = <strong>Missing</strong> if the SEO title field is blank; <strong>Auto-generated</strong> if it equals the product title after normalization (HTML stripped, entities decoded, whitespace/punctuation normalized), equals it after removing a trailing SKU/code suffix, is a truncated prefix (&ge;80% length) of the SKU-stripped product title, or is &ge;90% textually similar with no added SEO wording; otherwise <strong>Custom</strong>. Meta Description Status follows the same Missing/Auto-generated/Custom model, using exact match, prefix match, first-150&ndash;170-character truncation match, or &ge;90% similarity with no added SEO wording.<br>"
c = c.replace(old_foot_marker_start, new_foot, 1)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
print("KPIs -> total:", total, "missing_title:", missing_title_n, "auto_title:", auto_title_n,
      "missing_desc:", missing_desc_n, "auto_desc:", auto_desc_n, "ok:", ok_n)
