import re

BASE = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages"
req1_path = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\kamsi\data\2026-07-07_kamsi_req1_original_backup.html"
req2_path = BASE + r"\kamsi-req2-low-ctr-pages.html"
req3_path = BASE + r"\kamsi-req3-core-ga4-seo.html"
out_path = BASE + r"\kamsi-req1-slow-moving-products.html"

req1 = open(req1_path, encoding="utf-8").read()
req2 = open(req2_path, encoding="utf-8").read()
req3 = open(req3_path, encoding="utf-8").read()


def extract(src, need_wrap_strip=True):
    i_style = src.find("<style>")
    j_style = src.find("</style>", i_style) + len("</style>")
    # some pages have 2 <style> blocks; capture all of them up to </head>
    i_head_end = src.find("</head>")
    style_css = ""
    pos = i_style
    while True:
        s = src.find("<style>", pos)
        if s == -1 or s > i_head_end:
            break
        e = src.find("</style>", s) + len("</style>")
        style_css += src[s + len("<style>"):e - len("</style>")] + "\n"
        pos = e
    i_body = src.find("<body>")
    i_nav_end = src.find("</nav>", src.find('<a class="back"', i_body)) + len("</nav>")

    # first <script tag of ANY kind (attributed JSON data-holder or plain code)
    i_first_script = re.search(r"<script", src[i_nav_end:]).start() + i_nav_end
    panel_html_raw = src[i_nav_end:i_first_script]
    panel_html = panel_html_raw.rstrip()
    if need_wrap_strip:
        assert panel_html.endswith("</div>"), panel_html[-80:]
        panel_html = panel_html[: -len("</div>")].rstrip()

    # walk all <script ...>...</script> blocks from i_first_script to end of file;
    # non-executable ones (type="application/json" etc.) stay as literal panel HTML,
    # the plain executable <script> becomes the code to wrap in an IIFE.
    json_script_tags = []
    code_script_body = None
    pos = i_first_script
    while True:
        s = src.find("<script", pos)
        if s == -1:
            break
        tag_end = src.find(">", s) + 1
        close = src.find("</script>", tag_end)
        tag_open = src[s:tag_end]
        inner = src[tag_end:close]
        if 'type="application/json"' in tag_open or ("type=" in tag_open and "javascript" not in tag_open):
            json_script_tags.append(src[s:close + len("</script>")])
        else:
            assert code_script_body is None, "found more than one executable script block"
            code_script_body = inner
        pos = close + len("</script>")

    assert code_script_body is not None
    panel_html = panel_html + "\n" + "\n".join(json_script_tags)
    return style_css, panel_html, code_script_body


r1_css, r1_html, r1_script = extract(req1)
r2_css, r2_html, r2_script = extract(req2)
r3_css, r3_html, r3_script = extract(req3)

print("r1 html", len(r1_html), "script", len(r1_script))
print("r2 html", len(r2_html), "script", len(r2_script))
print("r3 html", len(r3_html), "script", len(r3_script))

# ---- req1 (panel 1): rename inline handler globals flt/rst/srt -> flt1/rst1/srt1 ----
assert 'oninput="flt()"' in r1_html
r1_html = r1_html.replace('oninput="flt()"', 'oninput="flt1()"')
assert 'onchange="flt()"' in r1_html
r1_html = r1_html.replace('onchange="flt()"', 'onchange="flt1()"')
assert 'onclick="rst()"' in r1_html
r1_html = r1_html.replace('onclick="rst()"', 'onclick="rst1()"')
# srt(N,bool) calls are in static HTML headers
r1_html = re.sub(r'onclick="srt\((\d),(true|false)\)"', r'onclick="srt1(\1,\2)"', r1_html)
r1_script = r1_script.rstrip() + "\nwindow.flt1=flt; window.rst1=rst; window.srt1=srt; if(typeof exp==='function') window.exp1=exp;\n"

# ---- req2 (panel 2): rename ids cnt/d/pinfo/psize/q/tb -> *2, rename inline handler globals ----
id_renames_2 = [
    ('id="cnt"', 'id="cnt2"'), ("getElementById('cnt')", "getElementById('cnt2')"),
    ('id="d"', 'id="d2"'), ("getElementById('d')", "getElementById('d2')"),
    ('id="pinfo"', 'id="pinfo2"'), ("getElementById('pinfo')", "getElementById('pinfo2')"),
    ('id="psize"', 'id="psize2"'), ("getElementById('psize')", "getElementById('psize2')"),
    ('id="q"', 'id="q2"'), ("getElementById('q')", "getElementById('q2')"),
    ('id="tb"', 'id="tb2"'), ("getElementById('tb')", "getElementById('tb2')"),
]
for old, new in id_renames_2:
    cnt_html = r2_html.count(old)
    cnt_script = r2_script.count(old)
    assert cnt_html + cnt_script > 0, f"pattern not found anywhere: {old}"
    r2_html = r2_html.replace(old, new)
    r2_script = r2_script.replace(old, new)

assert 'oninput="flt()"' in r2_html
r2_html = r2_html.replace('oninput="flt()"', 'oninput="flt2()"')
assert 'onchange="flt()"' in r2_html
r2_html = r2_html.replace('onchange="flt()"', 'onchange="flt2()"')
assert 'onclick="rst()"' in r2_html
r2_html = r2_html.replace('onclick="rst()"', 'onclick="rst2()"')
r2_html = re.sub(r'onclick="srt\((\d)\)"', r'onclick="srt2(\1)"', r2_html)
r2_script = r2_script.rstrip() + "\nwindow.flt2=flt; window.rst2=rst; window.srt2=srt; if(typeof exp==='function') window.exp2=exp;\n"

# ---- req3 (panel 3): rename id tb -> tb3, rename applyFilters -> applyFilters3 ----
assert 'id="tb"' in r3_html and "getElementById('tb')" in r3_script
r3_html = r3_html.replace('id="tb"', 'id="tb3"')
r3_script = r3_script.replace("getElementById('tb')", "getElementById('tb3')")
assert 'onchange="applyFilters()"' in r3_html
r3_html = r3_html.replace('onchange="applyFilters()"', 'onchange="applyFilters3()"')
r3_script = r3_script.rstrip() + "\nwindow.applyFilters3=applyFilters;\n"

TAB_CSS = """
.tab-panel{display:none;}
.tab-panel.active{display:block;}
"""

merged = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kamsi — SEO &amp; Digital Marketing Reports</title>
<style>
{r1_css}
</style>
<style>
{r2_css}
</style>
<style>
{r3_css}
</style>
<style>
{tab_css}
</style>
</head>
<body>
<div class="wrap">

<a class="back" href="../index.html">&larr; Back to all members</a>

<nav class="tab-nav" role="tablist" aria-label="Kamsi requirements">
  <button class="tab-btn active" onclick="showTab(1)">Requirement 1<span class="tab-label">Slow-Moving Product Visibility</span></button>
  <button class="tab-btn" onclick="showTab(2)">Requirement 2<span class="tab-label">Low CTR Page Identification</span></button>
  <button class="tab-btn" onclick="showTab(3)">Requirement 3<span class="tab-label">Core GA4 Data for SEO</span></button>
  <a class="tab-btn" href="kamsi-req4-product-priority-guidance.html">Requirement 4<span class="tab-label">Product Priority Guidance</span></a>
  <a class="tab-btn" href="kamsi-req5-missing-meta-detection.html">Requirement 5<span class="tab-label">Missing Meta Title &amp; Description</span></a>
</nav>

<div id="tab-panel-1" class="tab-panel active">
{r1_html}
</div>

<div id="tab-panel-2" class="tab-panel">
{r2_html}
</div>

<div id="tab-panel-3" class="tab-panel">
{r3_html}
</div>

</div>
<script>
function showTab(n){{
  document.querySelectorAll('.tab-panel').forEach((el,idx)=>el.classList.toggle('active', idx===n-1));
  document.querySelectorAll('.tab-nav .tab-btn').forEach((el,idx)=>{{
    if(el.tagName==='BUTTON') el.classList.toggle('active', idx===n-1);
  }});
}}
(function(){{
{r1_script}
}})();
(function(){{
{r2_script}
}})();
(function(){{
{r3_script}
}})();
</script>
</body>
</html>""".format(
    r1_css=r1_css, r2_css=r2_css, r3_css=r3_css, tab_css=TAB_CSS,
    r1_html=r1_html, r2_html=r2_html, r3_html=r3_html,
    r1_script=r1_script, r2_script=r2_script, r3_script=r3_script,
)

open(out_path, "w", encoding="utf-8").write(merged)
print("written:", out_path, len(merged) // 1024, "KB")
