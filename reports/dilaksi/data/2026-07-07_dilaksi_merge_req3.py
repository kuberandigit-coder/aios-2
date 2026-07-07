import re

BASE = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages"
current_path = BASE + r"\dilaksi.html"          # already has tab-panel-1 + tab-panel-2
req3_path = BASE + r"\dilaksi-req3-pages-for-removal.html"
out_path = current_path

current = open(current_path, encoding="utf-8").read()
req3 = open(req3_path, encoding="utf-8").read()

# ---- backup current merged file (1+2) before touching it ----
open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\dilaksi\data\2026-07-07_dilaksi_req1req2_merged_backup.html", "w", encoding="utf-8").write(current)

# ---- Extract req3 pieces ----
i_style3 = req3.find("<style>")
j_style3 = req3.find("</style>", i_style3) + len("</style>")
r3_style_css = req3[i_style3 + len("<style>"):j_style3 - len("</style>")]

i_body3 = req3.find("<body>")
i_nav_end3 = req3.find("</nav>", req3.find('<a class="back"', i_body3)) + len("</nav>")
i_script3 = req3.find("<script>")
i_script3_end = req3.find("</script>", i_script3)
r3_panel_html_raw = req3[i_nav_end3:i_script3]
r3_panel_html = r3_panel_html_raw.rstrip()
assert r3_panel_html.endswith("</div>"), r3_panel_html[-80:]
r3_panel_html = r3_panel_html[: -len("</div>")].rstrip()
r3_script_body = req3[i_script3 + len("<script>"):i_script3_end]

print("req3 panel html len:", len(r3_panel_html))
print("req3 script len:", len(r3_script_body))

# ---- Fix id="q" collision with req2's search box: rename to q3 ----
old_id_attr = 'id="q" placeholder="Search collection URL or title…" oninput="flt()"'
new_id_attr = 'id="q3" placeholder="Search collection URL or title…" oninput="flt()"'
assert old_id_attr in r3_panel_html, "q id attr not found in panel html"
r3_panel_html = r3_panel_html.replace(old_id_attr, new_id_attr)

assert "getElementById('q')" in r3_script_body
r3_script_body = r3_script_body.replace("getElementById('q')", "getElementById('q3')")

# ---- Expose inline-handler functions (flt, rst, srt) to window since script will be IIFE-wrapped ----
expose_line = "\nwindow.flt = flt; window.rst = rst; if (typeof srt === 'function') window.srt = srt;\n"
r3_script_body = r3_script_body.rstrip() + expose_line

# ---- Update tab-nav: Requirement 3 link -> button with showTab(3) ----
old_nav_r3 = '<a class="tab-btn" href="dilaksi-req3-pages-for-removal.html">Requirement 3<span class="tab-label">Pages for Removal</span></a>'
new_nav_r3 = '<button class="tab-btn" onclick="showTab(3)">Requirement 3<span class="tab-label">Pages for Removal</span></button>'
assert old_nav_r3 in current, "req3 nav link not found in current merged file"
current = current.replace(old_nav_r3, new_nav_r3)

# ---- Insert req3 style into <head>, panel into body, script IIFE before closing </script> ----
insert_style_marker = "<style>\n\n.tab-panel{display:none;}\n.tab-panel.active{display:block;}\n\n</style>\n</head>"
assert insert_style_marker in current
current = current.replace(
    insert_style_marker,
    "<style>\n" + r3_style_css + "\n</style>\n" + insert_style_marker,
    1,
)

# insert tab-panel-3 right after tab-panel-2's closing </div>, before the outer </div> (.wrap closer)
panel2_close_marker = "\n</div>\n\n</div>\n<script>"
assert panel2_close_marker in current, "panel2 close marker not found"
panel3_block = '\n</div>\n\n<div id="tab-panel-3" class="tab-panel">\n' + r3_panel_html + "\n</div>\n\n</div>\n<script>"
current = current.replace(panel2_close_marker, panel3_block, 1)

# insert req3's IIFE right before the closing </script>
closing_script_marker = "\n</script>\n</body>\n</html>"
assert current.count(closing_script_marker) == 1
r3_iife = "(function(){\n" + r3_script_body + "\n})();\n"
current = current.replace(closing_script_marker, "\n" + r3_iife + "</script>\n</body>\n</html>", 1)

open(out_path, "w", encoding="utf-8").write(current)
print("written:", out_path, len(current) // 1024, "KB")
