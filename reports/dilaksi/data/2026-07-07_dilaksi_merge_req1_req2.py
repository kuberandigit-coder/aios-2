import re

BASE = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages"
req1_path = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\dilaksi\data\2026-07-07_dilaksi_req1_original_backup.html"
req2_path = BASE + r"\dilaksi-req2-all-products.html"
out_path = req1_path  # overwrite dilaksi.html in place

req1 = open(req1_path, encoding="utf-8").read()
req2 = open(req2_path, encoding="utf-8").read()

# ---- Extract req1 pieces ----
# styles: two <style> blocks in head
r1_styles = re.findall(r"<style>.*?</style>", req1, re.DOTALL)
r1_style_css = "\n".join(s[len("<style>"):-len("</style>")] for s in r1_styles)

i_body1 = req1.find("<body>")
i_nav_end1 = req1.find("</nav>", req1.find('<a class="back"', i_body1)) + len("</nav>")
i_script1 = req1.find("<script>")
i_script1_end = req1.find("</script>", i_script1)
r1_panel_html_raw = req1[i_nav_end1:i_script1]
r1_panel_html = r1_panel_html_raw.rstrip()
assert r1_panel_html.endswith("</div>"), r1_panel_html[-80:]
r1_panel_html = r1_panel_html[: -len("</div>")].rstrip()
r1_script_body = req1[i_script1 + len("<script>"):i_script1_end]

# ---- Extract req2 pieces ----
i_style2 = req2.find("<style>")
j_style2 = req2.find("</style>", i_style2) + len("</style>")
r2_style_css = req2[i_style2 + len("<style>"):j_style2 - len("</style>")]

i_body2 = req2.find("<body>")
i_nav_end2 = req2.find("</nav>", req2.find('<a class="back"', i_body2)) + len("</nav>")
i_script2 = req2.find("<script>")
i_script2_end = req2.find("</script>", i_script2)
r2_panel_html_raw = req2[i_nav_end2:i_script2]
# trim trailing closing </div> (the .wrap closer) that belongs to the outer shell, not this panel
r2_panel_html = r2_panel_html_raw.rstrip()
assert r2_panel_html.endswith("</div>"), r2_panel_html[-80:]
r2_panel_html = r2_panel_html[: -len("</div>")].rstrip()
r2_script_body = req2[i_script2 + len("<script>"):i_script2_end]

print("req1 panel html len:", len(r1_panel_html))
print("req2 panel html len:", len(r2_panel_html))
print("req1 script len:", len(r1_script_body))
print("req2 script len:", len(r2_script_body))

TAB_CSS = """
.tab-panel{display:none;}
.tab-panel.active{display:block;}
"""

merged = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dilaksi — SEO &amp; Digital Marketing Reports</title>
<style>
{r1_css}
</style>
<style>
{r2_css}
</style>
<style>
{tab_css}
</style>
</head>
<body>
<div class="wrap">

<a class="back" href="../index.html">&larr; Back to all members</a>

<nav class="tab-nav" role="tablist" aria-label="Dilaksi requirements">
  <button class="tab-btn active" onclick="showTab(1)">Requirement 1<span class="tab-label">GA4 SEO Organic Report</span></button>
  <button class="tab-btn" onclick="showTab(2)">Requirement 2<span class="tab-label">Product Priority Guidance</span></button>
  <a class="tab-btn" href="dilaksi-req3-pages-for-removal.html">Requirement 3<span class="tab-label">Pages for Removal</span></a>
</nav>

<div id="tab-panel-1" class="tab-panel active">
{r1_html}
</div>

<div id="tab-panel-2" class="tab-panel">
{r2_html}
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
</script>
</body>
</html>""".format(
    r1_css=r1_style_css, r2_css=r2_style_css, tab_css=TAB_CSS,
    r1_html=r1_panel_html, r2_html=r2_panel_html,
    r1_script=r1_script_body, r2_script=r2_script_body,
)

open(out_path, "w", encoding="utf-8").write(merged)
print("written:", out_path, len(merged) // 1024, "KB")
