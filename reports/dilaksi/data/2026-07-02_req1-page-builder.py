import json, re, html, shutil

BASE = "C:/Users/PC/OneDrive/Desktop/kuberan web/"
OLD = BASE + "reports/digital-marketing-member-pages/pages/dilaksi.html"
DATA = json.load(open(BASE + "reports/dilaksi/data/2026-07-02_req1-ga4-organic-windows.json", encoding="utf-8"))

# GSC top-query map extracted from the existing Requirement 1 page (GSC last 30 days, to 2026-06-20)
old = open(OLD, encoding="utf-8").read()
QMAP = {}
for lp, q in re.findall(r'<td class="lp">(.*?)</td><td class="q">(.*?)</td>', old):
    lp = html.unescape(lp); q = html.unescape(q)
    if q and q != "—":
        QMAP[lp] = q

# compact datasets for embedding: per window -> {t: totals, n: page_count, r: top-50 rows}
embed = {}
for days, d in DATA.items():
    t = d["totals"]
    rows = []
    for r in d["rows"][:50]:
        lp = r[0].split("?")[0] or r[0]
        rows.append([lp, QMAP.get(lp, ""), int(r[1]), int(r[2]),
                     round(float(r[3]), 4), float(r[4]), round(float(r[5]), 2),
                     int(r[6]), round(float(r[7]), 2)])
    embed[days] = {"t": [int(t[0]), int(t[1]), round(float(t[2]), 4), float(t[3]),
                         round(float(t[4]), 2), int(t[5]), round(float(t[6]), 2)],
                   "n": d["page_count"], "r": rows}

PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Core GA4 Data for SEO — Organic Search | Dilaksi | LEDSone UK</title>
<style>
  :root{
    --ink:#1a2233; --muted:#5b6577; --line:#e3e7ee; --bg:#f5f7fa;
    --card:#ffffff; --accent:#1f5eff; --accent-soft:#eaf0ff;
    --na:#9aa3b2; --good:#0a7d4f;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  body{font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif; background:var(--bg); color:var(--ink); padding:32px 20px;}
  .wrap{max-width:1240px; margin:0 auto;}
  header{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:26px 30px; margin-bottom:18px;}
  h1{font-size:22px; letter-spacing:.2px;}
  .sub{color:var(--muted); font-size:13.5px; margin-top:6px;}
  .filters{display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; align-items:center;}
  .chip{background:var(--accent-soft); color:var(--accent); border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:600;}
  .rangebtns{display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; align-items:center;}
  .rangebtns .lbl{font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-right:2px;}
  .rbtn{padding:7px 16px; border:1px solid var(--line); border-radius:999px; background:var(--card); font-size:13px; font-weight:600; cursor:pointer; color:var(--muted);}
  .rbtn.on{background:var(--accent); color:#fff; border-color:var(--accent);}
  .cards{display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:18px;}
  .card{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px;}
  .card .label{font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.6px;}
  .card .value{font-size:24px; font-weight:700; margin-top:6px;}
  .card .note{font-size:11.5px; color:var(--muted); margin-top:4px;}
  .tablebox{background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden;}
  .tablebox .tbar{padding:14px 20px; border-bottom:1px solid var(--line); font-size:13px; color:var(--muted);}
  .scroll{overflow-x:auto;}
  table{width:100%; border-collapse:collapse; font-size:13px; min-width:1080px;}
  thead th{position:sticky; top:0; background:#f0f3f8; text-align:left; padding:11px 14px; font-size:11.5px; text-transform:uppercase; letter-spacing:.5px; color:#42506a; border-bottom:2px solid var(--line); white-space:nowrap;}
  thead th.num, td.num{text-align:right;}
  tbody td{padding:9px 14px; border-bottom:1px solid var(--line); vertical-align:top;}
  tbody tr:nth-child(even){background:#fafbfd;}
  tbody tr:hover{background:var(--accent-soft);}
  td.lp{max-width:360px; word-break:break-all; font-weight:500;}
  td.q{color:#33415c; max-width:230px;}
  td.na{color:var(--na); font-style:italic; text-align:center;}
  td.rev{font-weight:600; color:var(--good);}
  td.rev.zero{color:var(--na); font-weight:400;}
  .footnotes{margin-top:18px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px 24px; font-size:12.5px; color:var(--muted); line-height:1.65;}
  .footnotes h3{font-size:13px; color:var(--ink); margin-bottom:8px;}
  .footnotes strong{color:var(--ink);}
  @media (max-width:700px){ h1{font-size:18px;} .card .value{font-size:19px;} }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div style="font-size:12px;font-weight:700;letter-spacing:.8px;color:#1f5eff;text-transform:uppercase;margin-bottom:6px;">Requirement 1 — Completed</div>
    <h1>Core GA4 Data for SEO — Organic Search Landing Page Performance</h1>
    <div class="sub">Store: <strong>ledsone.co.uk</strong> (GA4 property 408110563) &nbsp;·&nbsp; Requested by: <strong>Dilaksi</strong> (SEO team) &nbsp;·&nbsp; Generated: <strong>2026-07-02</strong></div>
    <div class="filters">
      <span class="chip">Collection: All</span>
      <span class="chip">Channel: Organic Search only</span>
      <span class="chip">Source: GA4 Data API (live, true rolling windows ending today)</span>
    </div>
    <div class="rangebtns" id="ranges">
      <span class="lbl">Date range:</span>
      <button class="rbtn" data-d="60">60 days</button>
      <button class="rbtn" data-d="45">45 days</button>
      <button class="rbtn on" data-d="30">30 days</button>
      <button class="rbtn" data-d="15">15 days</button>
      <button class="rbtn" data-d="7">7 days</button>
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="label">Total Sessions</div><div class="value" id="c-sess"></div><div class="note" id="c-pages"></div></div>
    <div class="card"><div class="label">Total Users</div><div class="value" id="c-users"></div><div class="note">GA4 active users</div></div>
    <div class="card"><div class="label">Purchases</div><div class="value" id="c-pur"></div><div class="note">ecommerce purchases</div></div>
    <div class="card"><div class="label">Purchase Revenue</div><div class="value" id="c-rev"></div><div class="note">organic search only</div></div>
    <div class="card"><div class="label">Avg Engagement Rate</div><div class="value" id="c-eng"></div><div class="note">GA4 engagement rate</div></div>
  </div>

  <div class="tablebox">
    <div class="tbar" id="tbar"></div>
    <div class="scroll">
    <table>
      <thead>
        <tr>
          <th>Landing Page</th>
          <th>Query (top, GSC)</th>
          <th class="num">Sessions</th>
          <th class="num">Users</th>
          <th class="num">Engagement Rate</th>
          <th class="num">Avg. Engagement Time</th>
          <th class="num">Pages/Session</th>
          <th class="num">Purchases</th>
          <th class="num">Purchase Revenue (£)</th>
        </tr>
      </thead>
      <tbody id="tb"></tbody>
    </table>
    </div>
  </div>

  <div class="footnotes">
    <h3>Notes</h3>
    <strong>Date-range filter:</strong> each option (60 / 45 / 30 / 15 / 7 days) is a true rolling window ending today, fetched live from the GA4 Data API on 2026-07-02 — not a scaled or sampled slice of one export.<br>
    <strong>Data source:</strong> GA4 Data API (service account, property 408110563), dimension landingPagePlusQueryString (query strings stripped for display), filter sessionDefaultChannelGroup = Organic Search. Engagement rate, average engagement time per session and pages/session are now included directly from GA4 (previously unavailable in the PostgreSQL export).<br>
    <strong>Query column:</strong> top Google Search Console query for the page (GSC last 30 days, to 2026-06-20); shown where a mapping exists — GSC does not provide per-window queries for every page. "—" = no GSC query mapped.<br>
    <strong>Table:</strong> top 50 landing pages by sessions in the selected window. (not set) = GA4 could not attribute a landing page.
  </div>

</div>
<script>
const DATA = __DATA__;
const gbp = v => '£' + v.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function fmtTime(sec, sessions){
  if(!sessions) return 'N/A';
  const s = Math.round(sec / sessions);
  return Math.floor(s/60) + 'm ' + (s%60) + 's';
}
function render(d){
  const w = DATA[d], t = w.t;
  document.getElementById('c-sess').textContent = t[0].toLocaleString();
  document.getElementById('c-pages').textContent = 'all ' + w.n.toLocaleString() + ' organic landing pages';
  document.getElementById('c-users').textContent = t[1].toLocaleString();
  document.getElementById('c-pur').textContent = t[5].toLocaleString();
  document.getElementById('c-rev').textContent = gbp(t[6]);
  document.getElementById('c-eng').textContent = (t[2]*100).toFixed(1) + '%';
  document.getElementById('tbar').textContent = 'Top 50 landing pages by sessions (of ' + w.n.toLocaleString() +
    ' total) · Last ' + d + ' days ending today · Query = top GSC query for that page (GSC last 30 days, to 2026-06-20)';
  document.getElementById('tb').innerHTML = w.r.map(r =>
    '<tr><td class="lp">' + esc(r[0]) + '</td><td class="q">' + (r[1] ? esc(r[1]) : '—') + '</td>' +
    '<td class="num">' + r[2].toLocaleString() + '</td><td class="num">' + r[3].toLocaleString() + '</td>' +
    '<td class="num">' + (r[4]*100).toFixed(1) + '%</td><td class="num">' + fmtTime(r[5], r[2]) + '</td>' +
    '<td class="num">' + r[6].toFixed(2) + '</td><td class="num">' + r[7].toLocaleString() + '</td>' +
    '<td class="num rev' + (r[8] > 0 ? '' : ' zero') + '">' + r[8].toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}) + '</td></tr>'
  ).join('');
}
document.getElementById('ranges').addEventListener('click', e => {
  const b = e.target.closest('.rbtn'); if(!b) return;
  document.querySelectorAll('.rbtn').forEach(x => x.classList.toggle('on', x === b));
  render(b.dataset.d);
});
render('30');
</script>
</body>
</html>"""

page = PAGE.replace("__DATA__", json.dumps(embed, separators=(",", ":")))
open(OLD, "w", encoding="utf-8").write(page)
print("written KB:", len(page) // 1024, "| query map entries:", len(QMAP))
