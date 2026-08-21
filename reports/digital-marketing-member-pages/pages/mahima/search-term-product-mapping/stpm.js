/* stpm.js — REQ-DM-2026-08-MAHI01
   Mahima · Search Term → Product Mapping — browser controller.

   MOUNT MODEL
   -----------
   This is NOT a standalone page. mahima.html stays the persistent shell: its
   sidebar, header and tab bar remain in place, and this view is injected into
   the Mahima content area. The public surface is:

       window.MahimaSTPM.mount(rootElement)   // idempotent
       window.MahimaSTPM.unmount()            // releases body-level layers

   mount() fetches view.html once, injects it into the root, wires the
   controls, and loads only metadata + run history. The expensive Ledsone work
   happens on Run now, never on mount, so switching Mahima tabs stays instant.

   Contract with the server
   ------------------------
   All data arrives through /api/requirement?fn=mahima-stpm-*. The page holds
   no credentials: the session travels as the HttpOnly dm_session cookie, and
   no database connection string is ever visible here or in any response. */

'use strict';

(function () {
  var API = '/api/requirement?fn=';

  // Resolve view.html relative to THIS script, so the fragment loads correctly
  // whether the host page is pages/mahima.html or anything else.
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf('stpm.js') !== -1) { s = all[i].src; break; }
      }
    }
    return s ? s.replace(/[^/]*$/, '') : 'mahima/search-term-product-mapping/';
  })();

  var state = {
    mounted: false, root: null, meta: null,
    runId: null, run: null, rows: [], total: 0,
    offset: 0, limit: 50, sort: 'cost', dir: 'desc',
    busy: false, lastFocus: null, limitsFocus: null, layers: null,
  };

  function $(id) { return document.getElementById(id); }

  // ── transport ────────────────────────────────────────────────────────────
  function api(fn, opts) {
    var o = opts || {};
    var url = API + encodeURIComponent(fn) + (o.query ? '&' + o.query : '');
    var init = { method: o.method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (o.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(o.body); }
    return fetch(url, init).then(function (res) {
      if (res.status === 401) throw withCode('Your session has expired. Please sign in again.', 'UNAUTHORISED');
      return res.json().catch(function () {
        throw new Error('The server returned an unexpected response.');
      }).then(function (data) {
        if (!res.ok || data.ok === false) throw withCode(data.error || 'Request failed.', data.code);
        return data;
      });
    });
  }
  function withCode(msg, code) { var e = new Error(msg); e.code = code; return e; }

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nOrDash(v, dp) {
    if (v === null || v === undefined || v === '') return '—';
    var n = Number(v); if (!isFinite(n)) return '—';
    return n.toLocaleString('en-GB', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function money(v) {
    if (v === null || v === undefined || v === '') return '—';
    return '€' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(v) { return (v === null || v === undefined || v === '') ? '—' : Number(v).toFixed(2) + '%'; }
  function ratio(v) { return (v === null || v === undefined || v === '') ? '—' : Number(v).toFixed(2); }
  // Dates arrive as plain 'YYYY-MM-DD' strings — the server parses Postgres
  // DATE columns as text so no timezone shift can occur on the way here.
  function dateStr(v) { return v ? String(v).slice(0, 10) : '—'; }
  function dateTime(v) {
    if (!v) return '—';
    var d = new Date(v); if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg, tone) {
    var t = state.layers && state.layers.toast; if (!t) return;
    t.textContent = msg;
    t.setAttribute('data-tone', tone || 'ok');
    t.setAttribute('data-open', 'true');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.setAttribute('data-open', 'false'); }, 4200);
  }

  // ── body-level layers (drawer / scrim / toast) ───────────────────────────
  // These are position:fixed, so they live on <body> rather than inside the
  // Mahima content area, which is itself inside a transformed/scrolled shell.
  function createLayers() {
    if (state.layers) return state.layers;
    var scrim = document.createElement('div');
    scrim.className = 'stpm-scrim'; scrim.id = 'stpmScrim'; scrim.setAttribute('data-open', 'false');

    var drawer = document.createElement('aside');
    drawer.className = 'stpm-drawer'; drawer.id = 'stpmDrawer';
    drawer.setAttribute('data-open', 'false');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'stpmDrawerTitle');
    drawer.tabIndex = -1;
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="stpm-drawer-head">' +
        '<div style="min-width:0;flex:1">' +
          '<h2 id="stpmDrawerTitle">—</h2><div class="stpm-sub" id="stpmDrawerSub"></div>' +
        '</div>' +
        '<button class="stpm-drawer-close" id="stpmDrawerClose" type="button" aria-label="Close details">&times;</button>' +
      '</div>' +
      '<div class="stpm-drawer-body" id="stpmDrawerBody"></div>';

    var toastEl = document.createElement('div');
    toastEl.className = 'stpm-toast'; toastEl.id = 'stpmToast';
    toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    toastEl.setAttribute('data-open', 'false');

    var modalScrim = document.createElement('div');
    modalScrim.className = 'stpm-modal-scrim'; modalScrim.id = 'stpmLimitsScrim';
    modalScrim.setAttribute('data-open', 'false');
    modalScrim.hidden = true;
    modalScrim.innerHTML =
      '<div class="stpm-modal" role="dialog" aria-modal="true" aria-labelledby="stpmLimitsTitle">' +
        '<div class="stpm-modal-head">' +
          '<h2 id="stpmLimitsTitle">Current limitations</h2>' +
          '<button class="stpm-modal-close" id="stpmLimitsClose" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="stpm-modal-body">' +
          LIMITATIONS.map(function (l) {
            return '<div class="stpm-limit"><b>' + esc(l.title) + '</b><p>' + esc(l.body) + '</p></div>';
          }).join('') +
        '</div>' +
        '<div class="stpm-modal-foot">' +
          '<button class="stpm-btn" id="stpmLimitsDone" type="button">Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(scrim);
    document.body.appendChild(drawer);
    document.body.appendChild(toastEl);
    document.body.appendChild(modalScrim);

    scrim.addEventListener('click', closeDrawer);
    drawer.querySelector('#stpmDrawerClose').addEventListener('click', closeDrawer);
    modalScrim.querySelector('#stpmLimitsClose').addEventListener('click', closeLimits);
    modalScrim.querySelector('#stpmLimitsDone').addEventListener('click', closeLimits);
    // Backdrop click closes, matching the drawer's behaviour.
    modalScrim.addEventListener('click', function (e) { if (e.target === modalScrim) closeLimits(); });

    state.layers = { scrim: scrim, drawer: drawer, toast: toastEl, modalScrim: modalScrim };
    return state.layers;
  }

  function onKeydown(e) {
    if (e.key !== 'Escape' || !state.layers) return;
    // Innermost layer first: the modal sits above the drawer.
    if (state.layers.modalScrim.getAttribute('data-open') === 'true') { closeLimits(); return; }
    if (state.layers.drawer.getAttribute('data-open') === 'true') closeDrawer();
  }

  // ── known limitations modal ──────────────────────────────────────────────
  // Standing product constraints, in staff language. Deliberately separate
  // from the source-health banner, which reports what happened in THIS run.
  // No internal identifiers, table names or flag names appear here.
  var LIMITATIONS = [
    {
      title: 'Search-term freshness',
      body: 'Search-term data can lag behind campaign totals. Always check the ' +
            '“Search terms received up to” date shown above the results.',
    },
    {
      title: 'Wide custom periods',
      body: 'Large custom date ranges may take too long to process. If a wide range times out, ' +
            'use a shorter period.',
    },
    {
      title: 'Product match score',
      body: 'Match Score is ranking evidence, not a probability or a guaranteed confidence score. ' +
            'Uncertain product mappings stay as Manual Review or No Match.',
    },
    {
      title: 'Opportunity and intent analysis',
      body: 'Opportunity detection and informational-intent detection are deliberately ' +
            'conservative. Some recommendations still need a human to confirm them.',
    },
    {
      title: 'Recommendations are not published automatically',
      body: 'Negative keywords and opportunities are recommendations only. Nothing is ever ' +
            'published to Google Ads or Shopify from this screen.',
    },
  ];

  function openLimits() {
    var L = createLayers();
    state.limitsFocus = document.activeElement;
    L.modalScrim.setAttribute('data-open', 'true');
    L.modalScrim.hidden = false;
    // Focus the close button so keyboard users land inside the dialog.
    var close = L.modalScrim.querySelector('#stpmLimitsClose');
    if (close) close.focus();
  }

  function closeLimits() {
    if (!state.layers) return;
    state.layers.modalScrim.setAttribute('data-open', 'false');
    setTimeout(function () { if (state.layers) state.layers.modalScrim.hidden = true; }, 200);
    if (state.limitsFocus && state.limitsFocus.focus) state.limitsFocus.focus();
  }

  /** Keep Tab within the dialog while it is open. */
  function trapTab(e) {
    if (e.key !== 'Tab' || !state.layers) return;
    if (state.layers.modalScrim.getAttribute('data-open') !== 'true') return;
    var f = state.layers.modalScrim.querySelectorAll('button');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ── source health ────────────────────────────────────────────────────────
  var HEALTH_ICON = { healthy: '✓', fallback: '!', stale_ingestion: '!', no_data: '×', idle: '•' };

  function renderHealth(run, metaFreshness) {
    var el = $('stpmHealth'); if (!el) return;
    var warnings = (run && run.source_warnings) || [];
    var key = (run && run.source_health) || 'idle';
    el.setAttribute('data-state', key);
    $('stpmHealthIcon').textContent = HEALTH_ICON[key] || '•';

    var fb = warnings.filter(function (w) { return w.code === 'date_fallback_used'; })[0];
    var nd = warnings.filter(function (w) { return w.code === 'no_search_term_data'; })[0];
    var stale = warnings.filter(function (w) { return w.code === 'search_term_ingestion_stale'; })[0];

    var title, msg;
    if (nd) { title = nd.title; msg = nd.message; }
    else if (fb) { title = fb.title; msg = fb.message; }
    else if (stale) { title = stale.title; msg = stale.message; }
    else if (run) {
      title = 'Search-term data available for the requested period.';
      msg = 'Showing ' + dateStr(run.actual_start) + ' to ' + dateStr(run.actual_end) + '.';
    } else {
      title = 'Ready to run';
      msg = metaFreshness && metaFreshness.latest_search_term
        ? 'Search-term data is on record up to ' + dateStr(metaFreshness.latest_search_term) + '.'
        : 'Choose your campaigns and periods, then select Run now.';
    }
    $('stpmHealthTitle').textContent = title;
    $('stpmHealthMsg').textContent = msg;

    var ranges = $('stpmRanges');
    if (run) {
      var bits = [
        ['Requested', dateStr(run.requested_start) + ' → ' + dateStr(run.requested_end)],
        ['Showing', dateStr(run.actual_start) + ' → ' + dateStr(run.actual_end)],
        ['Compared with', dateStr(run.historical_start) + ' → ' + dateStr(run.historical_end)],
        ['Search terms received up to', dateStr(run.latest_search_term_source_date)],
        ['Campaign totals up to', dateStr(run.latest_campaign_source_date)],
      ];
      ranges.innerHTML = bits.map(function (b) {
        return '<span>' + esc(b[0]) + ' <b>' + esc(b[1]) + '</b></span>';
      }).join('');
      ranges.hidden = false;
    } else { ranges.hidden = true; }

    var det = $('stpmHealthDetails');
    if (warnings.length) { $('stpmHealthDetail').innerHTML = warnings.map(renderWarning).join(''); det.hidden = false; }
    else { det.hidden = true; det.open = false; }
  }

  function renderWarning(w) {
    var html = '<div class="stpm-grp"><div class="stpm-grp-t">' + esc(w.title) + '</div>' +
               '<div style="color:var(--stpm-ink-soft);margin-top:3px">' + esc(w.message) + '</div>';
    var d = w.detail || {};
    if (Array.isArray(d.campaigns) && d.campaigns.length) {
      html += '<ul>' + d.campaigns.slice(0, 20).map(function (c) {
        return '<li>' + esc(c.campaign_name) +
          (c.latest_date ? ' — latest data ' + esc(dateStr(c.latest_date)) : ' — no data on record') + '</li>';
      }).join('') + '</ul>';
      if (d.campaigns.length > 20) html += '<div style="color:var(--stpm-muted-faint);margin-top:4px">…and ' + (d.campaigns.length - 20) + ' more.</div>';
    }
    if (d.lag_days) {
      html += '<ul><li>Campaign totals current to ' + esc(dateStr(d.campaign_source_date)) + '</li>' +
              '<li>Search-term detail only to ' + esc(dateStr(d.search_term_source_date)) + '</li>' +
              '<li>Difference: ' + esc(d.lag_days) + ' days</li></ul>';
    }
    return html + '</div>';
  }

  // ── metadata ─────────────────────────────────────────────────────────────
  function loadMetadata() {
    return api('mahima-stpm-metadata').then(function (m) {
      state.meta = m;
      $('stpmScope').hidden = false;
      var list = $('stpmCampaignList');
      var fCamp = $('stpmFCampaign');
      list.innerHTML = '';
      (m.campaigns || []).forEach(function (c) {
        var id = 'stpmC_' + c.campaign_id;
        var label = document.createElement('label');
        label.setAttribute('for', id);
        label.innerHTML =
          '<input type="checkbox" id="' + esc(id) + '" value="' + esc(c.campaign_id) + '" checked>' +
          '<span class="stpm-nm">' + esc(c.campaign_name) + '</span>' +
          '<span class="stpm-ty">' + esc((c.campaign_type || '').replace('PERFORMANCE_MAX', 'PMAX')) + '</span>';
        list.appendChild(label);
        var opt = document.createElement('option');
        opt.value = c.campaign_id; opt.textContent = c.campaign_name;
        fCamp.appendChild(opt);
      });
      list.addEventListener('change', updateCampaignSummary);
      updateCampaignSummary();
      renderHealth(null, m.freshness);
      return m;
    });
  }

  function selectedCampaigns() {
    return Array.prototype.slice.call(document.querySelectorAll('#stpmCampaignList input:checked'))
      .map(function (i) { return i.value; });
  }

  function updateCampaignSummary() {
    var total = document.querySelectorAll('#stpmCampaignList input').length;
    var sel = selectedCampaigns().length;
    $('stpmCampaignSummary').textContent = sel === total ? 'All ' + total + ' campaigns' : sel + ' of ' + total + ' campaigns';
    $('stpmRunBtn').disabled = sel === 0 || state.busy;
  }

  // ── run ──────────────────────────────────────────────────────────────────
  function currentInput() {
    var p = $('stpmCurrentPreset').value;
    return p === 'custom'
      ? { preset: 'custom', start: $('stpmCurrentStart').value, end: $('stpmCurrentEnd').value }
      : { preset: 'last7' };
  }
  function historicalInput() {
    var p = $('stpmHistPreset').value;
    return p === 'custom'
      ? { preset: 'custom', start: $('stpmHistStart').value, end: $('stpmHistEnd').value }
      : { preset: p };
  }

  function setBusy(on) {
    state.busy = on;
    var btn = $('stpmRunBtn');
    btn.disabled = on || selectedCampaigns().length === 0;
    $('stpmRunBtnLabel').textContent = on ? 'Running…' : 'Run now';
    var sp = btn.querySelector('.stpm-spinner');
    if (on && !sp) { var s = document.createElement('span'); s.className = 'stpm-spinner'; btn.insertBefore(s, btn.firstChild); }
    if (!on && sp) sp.remove();
  }

  function runNow() {
    if (state.busy) return;                       // guards double-click
    var campaigns = selectedCampaigns();
    if (!campaigns.length) { toast('Select at least one campaign.', 'error'); return; }

    setBusy(true);
    $('stpmResultsState').innerHTML =
      '<h3>Running…</h3><p>Reading search-term data, applying the waste rules and matching Shopify products. ' +
      'This can take a moment for a long period.</p>';
    $('stpmResultsState').hidden = false;
    $('stpmTableWrap').hidden = true;
    $('stpmPager').hidden = true;

    api('mahima-stpm-run', {
      method: 'POST',
      body: {
        campaign_ids: campaigns,
        current: currentInput(),
        historical: historicalInput(),
        idempotency_key: 'stpm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
      },
    }).then(function (out) {
      state.runId = out.run.run_id; state.run = out.run; state.offset = 0;
      renderHealth(out.run); renderTiles(out.run);
      return loadResults();
    }).then(function () {
      loadHistory(); toast('Run complete.');
    }).catch(showError).then(function () { setBusy(false); });
  }

  function showError(err) {
    $('stpmTableWrap').hidden = true;
    $('stpmPager').hidden = true;
    $('stpmFilters').hidden = true;
    var s = $('stpmResultsState');
    s.hidden = false;
    s.innerHTML = '<h3>' + esc(err.message || 'Something went wrong.') + '</h3><p>' +
      (err.code === 'UNAUTHORISED' ? 'Open the dashboard again to sign in, then retry.'
                                   : 'If this keeps happening, contact the technical team.') + '</p>';
    toast(err.message || 'Request failed.', 'error');
  }

  // ── tiles ────────────────────────────────────────────────────────────────
  function renderTiles(run) {
    var tiles = [
      { k: 'Search terms', v: nOrDash(run.row_count) },
      { k: 'Spend', v: money(run.total_cost), s: 'in period shown' },
      { k: 'Conversions', v: nOrDash(run.total_conversions, 2), s: 'vs ' + nOrDash(run.historical_conversions_total, 2) + ' historical' },
      { k: 'Negative candidates', v: nOrDash(run.negative_candidate_count), tone: 'critical', s: 'need review' },
      { k: 'Opportunities', v: nOrDash(run.opportunity_count), tone: 'info', s: 'incl. candidates' },
      { k: 'Product matches', v: nOrDash(run.product_match_count), tone: 'positive', s: 'of ' + nOrDash(run.row_count) + ' terms' },
    ];
    $('stpmTiles').innerHTML = tiles.map(function (t) {
      return '<div class="stpm-card stpm-tile"' + (t.tone ? ' data-tone="' + t.tone + '"' : '') + '>' +
        '<span class="stpm-k">' + esc(t.k) + '</span><span class="stpm-v">' + esc(t.v) + '</span>' +
        (t.s ? '<span class="stpm-s">' + esc(t.s) + '</span>' : '') + '</div>';
    }).join('');
    $('stpmTiles').hidden = false;
  }

  // ── table ────────────────────────────────────────────────────────────────
  var COLUMNS = [
    { key: 'search_term', label: 'Search term', sort: 'search_term', sticky: true },
    { key: 'campaign', label: 'Campaign', sort: 'campaign' },
    { key: 'clicks', label: 'Clicks', sort: 'clicks', n: true },
    { key: 'impressions', label: 'Impr.', sort: 'impressions', n: true },
    { key: 'ctr', label: 'CTR', sort: 'ctr', n: true },
    { key: 'cost', label: 'Cost', sort: 'cost', n: true },
    { key: 'conversions', label: 'Conv.', sort: 'conversions', n: true },
    { key: 'conversion_value', label: 'Conv. value', sort: 'conversion_value', n: true },
    { key: 'roas', label: 'ROAS', sort: 'roas', n: true },
    { key: 'historical_conversions', label: 'Hist. conv.', sort: 'historical_conversions', n: true },
    { key: 'performance_status', label: 'Status', sort: 'performance_status' },
    { key: 'waste', label: 'Waste reason' },
    { key: 'decision', label: 'Decision', sort: 'decision' },
    { key: 'opportunity', label: 'Opportunity' },
    { key: 'product', label: 'Shopify product' },
    { key: 'match_type', label: 'Match' },
    { key: 'match_score', label: 'Score', sort: 'match_score', n: true },
    { key: 'mapping_status', label: 'Mapping', sort: 'mapping_status' },
    { key: 'review_status', label: 'Review', sort: 'review_status' },
  ];

  function renderHead() {
    $('stpmGridHead').innerHTML = COLUMNS.map(function (c) {
      var cls = (c.sticky ? 'stpm-stick ' : '') + (c.n ? 'stpm-n ' : '') + (c.sort ? 'stpm-sortable' : '');
      var dir = state.sort === c.sort ? '<span class="stpm-dir">' + (state.dir === 'asc' ? '▲' : '▼') + '</span>' : '';
      var attrs = c.sort
        ? ' data-sort="' + esc(c.sort) + '" tabindex="0" role="button" aria-sort="' +
          (state.sort === c.sort ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"'
        : '';
      return '<th class="' + cls.trim() + '"' + attrs + '>' + esc(c.label) + dir + '</th>';
    }).join('');
  }

  function chip(text, kind) {
    if (!text) return '<span class="stpm-chip stpm-chip-none">—</span>';
    return '<span class="stpm-chip stpm-chip-' + kind + '">' + esc(text) + '</span>';
  }
  function decisionChip(d) {
    if (d === 'Negative Keyword') return chip(d, 'negative');
    if (d === 'Keyword Opportunity') return chip(d, 'opportunity');
    return chip(d || 'Keep', 'keep');
  }
  function statusChip(s) {
    if (s === 'Working') return chip(s, 'working');
    if (s === 'Dropped') return chip(s, 'dropped');
    return chip(s || 'No Conversions', 'none');
  }
  function mappingChip(s) {
    if (s === 'Auto Matched') return chip(s, 'auto');
    if (s === 'Manual Review') return chip(s, 'manual');
    return chip(s || 'No Match', 'none');
  }
  function reviewChip(s) {
    if (s === 'Approved') return chip(s, 'approved');
    if (s === 'Rejected') return chip(s, 'rejected');
    return chip(s || 'Pending', 'pending');
  }
  function needsAttention(r) { var b = r.decision_basis; return !!(b && b.needs_attention); }

  function cellFor(col, r) {
    switch (col.key) {
      case 'search_term':
        return '<div class="stpm-term">' + esc(r.search_term) +
          (needsAttention(r) ? '<span class="stpm-attn" title="Flagged for review"></span>' : '') + '</div>' +
          '<div class="stpm-term-sub">' + esc(dateStr(r.source_start)) + ' → ' + esc(dateStr(r.source_end)) + '</div>';
      case 'campaign':
        return '<div>' + esc(r.campaign_name || '—') + '</div>' +
          '<div class="stpm-term-sub">' + esc((r.campaign_type || '').replace('PERFORMANCE_MAX', 'PMax')) + '</div>';
      case 'clicks': return nOrDash(r.clicks);
      case 'impressions': return nOrDash(r.impressions);
      case 'ctr': return pct(r.ctr);
      case 'cost': return money(r.cost);
      case 'conversions': return nOrDash(r.conversions, 2);
      case 'conversion_value': return money(r.conversion_value);
      case 'roas': return ratio(r.roas);
      case 'historical_conversions': return nOrDash(r.historical_conversions, 2);
      case 'performance_status': return statusChip(r.performance_status);
      case 'waste': return r.waste_reason_summary ? esc(r.waste_reason_summary) : '—';
      case 'decision': return decisionChip(r.decision);
      case 'opportunity':
        if (r.keyword_opportunity) return chip('Yes', 'opportunity');
        if (r.opportunity_candidate) return chip('Candidate', 'manual');
        return '<span class="stpm-chip stpm-chip-none">No</span>';
      case 'product':
        if (!r.product_id) return '<span class="stpm-nomatch">No match</span>';
        return '<div class="stpm-prod">' +
          (r.product_url ? '<a href="' + esc(r.product_url) + '" target="_blank" rel="noopener">' + esc(r.product_title || r.product_id) + '</a>'
                         : esc(r.product_title || r.product_id)) +
          '<div class="stpm-pid">' + esc(r.product_id) + '</div></div>';
      case 'match_type': return r.match_type ? esc(r.match_type) : '—';
      case 'match_score': return (r.match_score === null || r.match_score === undefined) ? '—' : ratio(r.match_score);
      case 'mapping_status': return mappingChip(r.mapping_status);
      case 'review_status': return reviewChip(r.review_status);
      default: return '—';
    }
  }

  function renderRows() {
    if (!state.rows.length) {
      $('stpmTableWrap').hidden = true;
      $('stpmPager').hidden = true;
      var s = $('stpmResultsState');
      s.hidden = false;
      if (state.total === 0 && activeFilterCount() === 0) {
        s.innerHTML = '<h3>No search terms in this run</h3><p>' +
          esc(($('stpmHealthMsg') && $('stpmHealthMsg').textContent) || 'No rows were produced for the selected period.') + '</p>';
      } else {
        s.innerHTML = '<h3>No rows match these filters</h3><p>Try clearing one or more filters.</p>' +
          '<button class="stpm-btn" type="button" id="stpmEmptyReset">Reset filters</button>';
        var b = $('stpmEmptyReset');
        if (b) b.addEventListener('click', function () { clearFilters(false); });
      }
      return;
    }

    $('stpmResultsState').hidden = true;
    $('stpmTableWrap').hidden = false;
    $('stpmPager').hidden = false;

    $('stpmGridBody').innerHTML = state.rows.map(function (r, i) {
      return '<tr data-i="' + i + '" tabindex="0" aria-selected="false">' +
        COLUMNS.map(function (c) {
          return '<td class="' + (c.sticky ? 'stpm-stick ' : '') + (c.n ? 'stpm-num' : '') + '">' + cellFor(c, r) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    var from = state.offset + 1, to = state.offset + state.rows.length;
    $('stpmPagerInfo').textContent = 'Showing ' + from + '–' + to + ' of ' + state.total.toLocaleString('en-GB') + ' terms';
    $('stpmPrevPage').disabled = state.offset === 0;
    $('stpmNextPage').disabled = to >= state.total;
    $('stpmResultsBadge').textContent = state.total ? state.total.toLocaleString('en-GB') : '';
  }

  var FILTER_IDS = ['stpmFSearch', 'stpmFCampaign', 'stpmFDecision', 'stpmFStatus', 'stpmFMapping', 'stpmFReview', 'stpmFProduct'];

  function filterQuery() {
    var q = [];
    var add = function (k, v) { if (v) q.push(k + '=' + encodeURIComponent(v)); };
    add('search', $('stpmFSearch').value.trim());
    add('campaign_id', $('stpmFCampaign').value);
    add('decision', $('stpmFDecision').value);
    add('performance_status', $('stpmFStatus').value);
    add('mapping_status', $('stpmFMapping').value);
    add('review_status', $('stpmFReview').value);
    add('product', $('stpmFProduct').value.trim());
    return q.join('&');
  }
  function activeFilterCount() {
    return FILTER_IDS.filter(function (id) { var e = $(id); return e && e.value.trim() !== ''; }).length;
  }
  function syncFilterChrome() {
    var n = activeFilterCount();
    $('stpmFilterCount').textContent = n + (n === 1 ? ' filter' : ' filters');
    $('stpmFilterCount').hidden = n === 0;
    $('stpmClearFilters').hidden = n === 0;
  }
  function clearFilters(silent) {
    FILTER_IDS.forEach(function (id) { var e = $(id); if (e) e.value = ''; });
    syncFilterChrome();
    if (!silent) { state.offset = 0; loadResults(); }
  }

  function loadResults() {
    if (!state.runId) return Promise.resolve();
    var q = 'run_id=' + encodeURIComponent(state.runId) +
      '&limit=' + state.limit + '&offset=' + state.offset +
      '&sort=' + encodeURIComponent(state.sort) + '&dir=' + state.dir;
    var f = filterQuery(); if (f) q += '&' + f;
    return api('mahima-stpm-run-detail', { query: q }).then(function (d) {
      state.run = d.run; state.rows = d.rows || []; state.total = d.total || 0;
      $('stpmFilters').hidden = false;
      syncFilterChrome(); renderHead(); renderRows();
    }).catch(showError);
  }

  // ── drawer ───────────────────────────────────────────────────────────────
  function openDrawer(i) {
    var r = state.rows[i]; if (!r) return;
    var L = createLayers();
    state.lastFocus = document.activeElement;

    Array.prototype.forEach.call(document.querySelectorAll('#stpmGridBody tr'), function (tr) {
      tr.setAttribute('aria-selected', tr.getAttribute('data-i') === String(i) ? 'true' : 'false');
    });

    L.drawer.querySelector('#stpmDrawerTitle').textContent = r.search_term;
    L.drawer.querySelector('#stpmDrawerSub').textContent =
      (r.campaign_name || '—') + ' · ' + dateStr(r.source_start) + ' → ' + dateStr(r.source_end);
    L.drawer.querySelector('#stpmDrawerBody').innerHTML = drawerHtml(r);

    L.drawer.hidden = false;
    requestAnimationFrame(function () {
      L.drawer.setAttribute('data-open', 'true');
      L.scrim.setAttribute('data-open', 'true');
      L.drawer.focus();
    });

    Array.prototype.forEach.call(L.drawer.querySelectorAll('[data-review]'), function (b) {
      b.addEventListener('click', function () { setReview(r, b.getAttribute('data-review')); });
    });
  }

  function closeDrawer() {
    if (!state.layers) return;
    var L = state.layers;
    L.drawer.setAttribute('data-open', 'false');
    L.scrim.setAttribute('data-open', 'false');
    setTimeout(function () { L.drawer.hidden = true; }, 200);
    Array.prototype.forEach.call(document.querySelectorAll('#stpmGridBody tr'), function (tr) {
      tr.setAttribute('aria-selected', 'false');
    });
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  function kv(k, v) { return '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>'; }
  function kvTxt(k, v) { return '<dt>' + esc(k) + '</dt><dd class="stpm-txt">' + esc(v === null || v === undefined ? '—' : v) + '</dd>'; }

  function drawerHtml(r) {
    var h = '';
    h += '<div class="stpm-sec"><h3>Performance</h3><dl class="stpm-kv">' +
      kv('Clicks', nOrDash(r.clicks)) + kv('Impressions', nOrDash(r.impressions)) +
      kv('CTR', pct(r.ctr)) + kv('Cost', money(r.cost)) +
      kv('Conversions', nOrDash(r.conversions, 2)) + kv('Conversion value', money(r.conversion_value)) +
      kv('ROAS', ratio(r.roas)) + '</dl></div>';

    // Current vs historical only. No daily/weekly/monthly chart: the trend
    // bucket granularity is not business-ratified.
    h += '<div class="stpm-sec"><h3>Current vs historical</h3><dl class="stpm-kv">' +
      kv('Conversions now', nOrDash(r.conversions, 2)) +
      kv('Conversions before', nOrDash(r.historical_conversions, 2)) +
      kv('Spend before', money(r.historical_cost)) +
      kv('Value before', money(r.historical_conversion_value)) +
      kvTxt('Performance status', r.performance_status) + '</dl></div>';

    h += '<div class="stpm-sec"><h3>Why this decision</h3>';
    var wr = Array.isArray(r.waste_reasons) ? r.waste_reasons : [];
    if (wr.length) {
      h += wr.map(function (w) {
        return '<div class="stpm-rule"><b>' + esc(w.label || w.rule) + '</b>' +
          (w.explain ? '<div class="stpm-why">' + esc(w.explain) + '</div>' : '') +
          (w.outcome ? '<div class="stpm-out">Rule outcome: ' + esc(w.outcome) + '</div>' : '') + '</div>';
      }).join('');
    } else { h += '<div class="stpm-note">No waste rule fired for this term.</div>'; }
    h += '<dl class="stpm-kv" style="margin-top:9px">' + kvTxt('Decision', r.decision) +
      kvTxt('Negative recommended', r.negative_keyword_recommended ? 'Yes' : 'No') + '</dl>';
    var basis = r.decision_basis || {};
    if (basis.reason) h += '<div class="stpm-note" style="margin-top:9px">' + esc(basis.reason) + '</div>';
    if (basis.multiple_rules_fired) {
      h += '<div class="stpm-note stpm-warnbox" style="margin-top:7px">Several rules fired for this term. ' +
        'The order in which conflicting rules should win has not been confirmed by the business, ' +
        'so every rule is listed above rather than one being chosen automatically.</div>';
    }
    if (r.keyword_opportunity || r.opportunity_candidate) {
      h += '<dl class="stpm-kv" style="margin-top:9px">' +
        kvTxt('Opportunity', r.keyword_opportunity ? 'Confirmed' : 'Candidate — manual validation required') + '</dl>' +
        (r.opportunity_reason ? '<div class="stpm-note" style="margin-top:8px">' + esc(r.opportunity_reason) + '</div>' : '');
    }
    h += '</div>';

    h += '<div class="stpm-sec"><h3>Product match</h3>';
    if (r.product_id) {
      var ev = r.match_evidence || {};
      h += '<dl class="stpm-kv">' + kvTxt('Product', r.product_title || '—') + kv('Product ID', r.product_id) +
        kvTxt('Match type', r.match_type) + kvTxt('Matched on', ev.source_label || r.match_source || '—') +
        kv('Score', (r.match_score === null || r.match_score === undefined) ? '—' : ratio(r.match_score)) +
        ((r.runner_up_score !== null && r.runner_up_score !== undefined) ? kv('Runner-up score', ratio(r.runner_up_score)) : '') +
        kvTxt('Mapping status', r.mapping_status) + '</dl>';
      if (ev.matched_text) h += '<div class="stpm-note" style="margin-top:9px"><b>Matched text</b><br>' + esc(ev.matched_text) + '</div>';
      if (r.product_url) h += '<div style="margin-top:9px"><a href="' + esc(r.product_url) + '" target="_blank" rel="noopener">Open product on ledsone.de →</a></div>';
    } else {
      h += '<div class="stpm-note">No product matched with enough evidence, so no product was assigned. ' +
        'A term is left unmatched rather than being forced onto the closest product.</div>';
    }
    if (r.mapping_reason) h += '<div class="stpm-sep-label">' + esc(r.mapping_reason) + '</div>';
    h += '</div>';

    var flags = Array.isArray(r.data_quality_flags) ? r.data_quality_flags : [];
    if (flags.length) {
      h += '<div class="stpm-sec"><h3>Data quality</h3><div class="stpm-note stpm-warnbox">' +
        flags.map(function (f) {
          if (f.code === 'meta_title_missing') return 'This product has no Meta Title in Shopify; matching used the remaining fields.';
          if (f.code === 'meta_description_missing') return 'This product has no Meta Description in Shopify; matching used the remaining fields.';
          if (f.code === 'cost_missing') return 'Cost was not reported for this term, so cost-based rules were not evaluated for it.';
          if (f.code === 'intent_coverage_limited') return f.note || 'Intent coverage limited — review recommended.';
          return f.code;
        }).map(esc).join('<br>') + '</div></div>';
    }

    var rs = r.review_status || 'Pending';
    h += '<div class="stpm-sec"><h3>Human review</h3>' +
      '<div class="stpm-sep-label" style="margin:0 0 8px">System recommendation: <strong>' + esc(r.decision) +
      '</strong>. Changing the review below does not change it.</div>' +
      '<div class="stpm-review-row">' +
      ['Pending', 'Approved', 'Rejected'].map(function (v) {
        return '<button class="stpm-btn" type="button" data-review="' + v + '" aria-pressed="' + (rs === v ? 'true' : 'false') + '">' + v + '</button>';
      }).join('') + '</div>' +
      (r.reviewer ? '<div class="stpm-sep-label">Last changed by ' + esc(r.reviewer) + ' on ' + esc(dateTime(r.reviewed_at)) + '.</div>' : '') +
      '</div>';
    return h;
  }

  function setReview(row, value) {
    api('mahima-stpm-review', { method: 'POST', body: { result_id: row.result_id, review_status: value } })
      .then(function () {
        // Only reflect the change after the server confirms it.
        row.review_status = value;
        Array.prototype.forEach.call(state.layers.drawer.querySelectorAll('[data-review]'), function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-review') === value ? 'true' : 'false');
        });
        renderRows();
        toast('Review set to ' + value + '.');
      })
      .catch(function (err) { toast(err.message || 'Could not save the review.', 'error'); });
  }

  // ── history ──────────────────────────────────────────────────────────────
  function loadHistory() {
    return api('mahima-stpm-runs', { query: 'limit=10' }).then(function (d) {
      var runs = d.runs || [];
      $('stpmHistoryBadge').textContent = runs.length ? String(runs.length) : '';
      if (!runs.length) {
        $('stpmHistoryState').innerHTML = '<h3>No runs yet</h3><p>Runs appear here once you use Run now.</p>';
        $('stpmHistoryState').hidden = false; $('stpmRuns').hidden = true; return;
      }
      $('stpmHistoryState').hidden = true;
      $('stpmRuns').hidden = false;
      $('stpmRuns').innerHTML = runs.map(function (r) {
        var badge = r.status === 'FAILED' ? chip('Failed', 'negative')
          : r.fallback_used ? chip('14-day fallback', 'manual')
          : r.source_health === 'stale_ingestion' ? chip('Stale source', 'manual')
          : r.row_count === 0 ? chip('No data', 'none')
          : chip('Complete', 'approved');
        return '<button class="stpm-run" type="button" data-run="' + esc(r.run_id) + '">' +
          '<div class="stpm-run-main">' +
            '<div class="stpm-run-t"><span class="stpm-run-no">#' + esc(r.run_no) + '</span>' +
              '<span class="stpm-run-when">' + esc(dateTime(r.created_at)) + '</span>' + badge + '</div>' +
            '<div class="stpm-run-meta">' +
              '<span>Requested <b>' + esc(dateStr(r.requested_start)) + ' → ' + esc(dateStr(r.requested_end)) + '</b></span>' +
              '<span>Showing <b>' + esc(dateStr(r.actual_start)) + ' → ' + esc(dateStr(r.actual_end)) + '</b></span>' +
              '<span>Compared with <b>' + esc(dateStr(r.historical_start)) + ' → ' + esc(dateStr(r.historical_end)) + '</b></span>' +
            '</div>' +
            '<div class="stpm-run-meta">' +
              '<span>' + esc(r.campaigns_with_data) + ' of ' + esc(r.campaigns_selected) + ' campaigns had data</span>' +
              '<span>Source to <b>' + esc(dateStr(r.latest_search_term_source_date)) + '</b></span>' +
              '<span>By ' + esc(r.created_by) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="stpm-run-stats">' + stat(r.row_count, 'Terms') + stat(r.negative_candidate_count, 'Negative') + stat(r.opportunity_count, 'Opps') + '</div>' +
          '</button>';
      }).join('');
      Array.prototype.forEach.call(document.querySelectorAll('#stpmRuns [data-run]'), function (b) {
        b.addEventListener('click', function () { openRun(b.getAttribute('data-run')); });
      });
    }).catch(function (err) {
      $('stpmHistoryState').innerHTML = '<h3>' + esc(err.message) + '</h3>';
      $('stpmHistoryState').hidden = false;
    });
  }

  function stat(v, k) {
    return '<div class="stpm-run-stat"><span class="stpm-v">' + esc(nOrDash(v)) + '</span><span class="stpm-k">' + esc(k) + '</span></div>';
  }

  /* Opening a past run reads its STORED snapshot from Neon — it is never
     recomputed from today's Ledsone data, so an old run keeps showing exactly
     what the operator saw. */
  function openRun(runId) {
    state.runId = runId; state.offset = 0;
    clearFilters(true);
    showTab('results');
    return loadResults().then(function () {
      if (state.run) { renderHealth(state.run); renderTiles(state.run); }
      toast('Showing the stored results for run #' + (state.run ? state.run.run_no : '') + '.');
    });
  }

  function showTab(which) {
    var isResults = which === 'results';
    $('stpmTabResults').setAttribute('aria-selected', String(isResults));
    $('stpmTabHistory').setAttribute('aria-selected', String(!isResults));
    $('stpmPanelResults').hidden = !isResults;
    $('stpmPanelHistory').hidden = isResults;
  }

  function download(type) {
    if (!state.runId) { toast('Run the report first.', 'error'); return; }
    var q = 'run_id=' + encodeURIComponent(state.runId) + '&type=' + type;
    var f = filterQuery(); if (f) q += '&' + f;
    window.location.href = API + 'mahima-stpm-export&' + q;
  }

  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // ── wiring ───────────────────────────────────────────────────────────────
  function wire() {
    $('stpmRunBtn').addEventListener('click', runNow);
    $('stpmCurrentPreset').addEventListener('change', function () { $('stpmCurrentCustom').hidden = this.value !== 'custom'; });
    $('stpmHistPreset').addEventListener('change', function () { $('stpmHistCustom').hidden = this.value !== 'custom'; });
    $('stpmTabResults').addEventListener('click', function () { showTab('results'); });
    $('stpmTabHistory').addEventListener('click', function () { showTab('history'); loadHistory(); });

    function onSort(e) {
      var th = e.target.closest('th[data-sort]'); if (!th) return;
      var key = th.getAttribute('data-sort');
      if (state.sort === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort = key; state.dir = 'desc'; }
      state.offset = 0; loadResults();
    }
    $('stpmGridHead').addEventListener('click', onSort);
    $('stpmGridHead').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(e); }
    });

    $('stpmGridBody').addEventListener('click', function (e) {
      if (e.target.closest('a')) return;                 // let product links work
      var tr = e.target.closest('tr[data-i]');
      if (tr) openDrawer(Number(tr.getAttribute('data-i')));
    });
    $('stpmGridBody').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tr = e.target.closest('tr[data-i]');
      if (tr) { e.preventDefault(); openDrawer(Number(tr.getAttribute('data-i'))); }
    });

    var reload = debounce(function () { state.offset = 0; syncFilterChrome(); loadResults(); }, 260);
    ['stpmFSearch', 'stpmFProduct'].forEach(function (id) { $(id).addEventListener('input', reload); });
    ['stpmFCampaign', 'stpmFDecision', 'stpmFStatus', 'stpmFMapping', 'stpmFReview'].forEach(function (id) {
      $(id).addEventListener('change', function () { state.offset = 0; syncFilterChrome(); loadResults(); });
    });
    $('stpmClearFilters').addEventListener('click', function () { clearFilters(false); });

    $('stpmPageSize').addEventListener('change', function () { state.limit = Number(this.value) || 50; state.offset = 0; loadResults(); });
    $('stpmPrevPage').addEventListener('click', function () { state.offset = Math.max(0, state.offset - state.limit); loadResults(); });
    $('stpmNextPage').addEventListener('click', function () { state.offset = state.offset + state.limit; loadResults(); });

    $('stpmDlFull').addEventListener('click', function () { download('full'); });
    $('stpmDlNeg').addEventListener('click', function () { download('negative'); });
    $('stpmDlOpp').addEventListener('click', function () { download('opportunity'); });

    var limitsBtn = $('stpmLimitsBtn');
    if (limitsBtn) limitsBtn.addEventListener('click', openLimits);

    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keydown', trapTab);
  }

  // ── public API ───────────────────────────────────────────────────────────
  var MahimaSTPM = {
    /**
     * Mount into `root`. Idempotent: calling it again when already mounted is
     * a no-op, so switching away and back does not re-fetch or re-initialise.
     */
    mount: function (root) {
      if (!root) return Promise.resolve();
      if (state.mounted && state.root === root) return Promise.resolve();
      state.root = root;
      root.classList.add('stpm');

      return fetch(BASE + 'view.html', { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('Could not load the Search Term view (' + r.status + ').');
          return r.text();
        })
        .then(function (html) {
          root.innerHTML = html;
          state.mounted = true;
          createLayers();
          wire();
          // Only metadata + history on mount; Ledsone work waits for Run now.
          return loadMetadata().then(loadHistory).catch(function (err) {
            var h = $('stpmHealth');
            if (h) {
              h.setAttribute('data-state', 'no_data');
              $('stpmHealthTitle').textContent = err.message || 'Could not load this view.';
              $('stpmHealthMsg').textContent = err.code === 'UNAUTHORISED'
                ? 'Open the dashboard again to sign in, then reload this page.'
                : 'If this keeps happening, contact the technical team.';
            }
          });
        })
        .catch(function (err) {
          root.innerHTML = '<div class="stpm-state"><h3>' + esc(err.message) + '</h3>' +
            '<p>If this keeps happening, contact the technical team.</p></div>';
        });
    },

    /** Remove the body-level layers and listeners. Content stays cached in the root. */
    unmount: function () {
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('keydown', trapTab);
      if (state.layers) {
        ['scrim', 'drawer', 'toast', 'modalScrim'].forEach(function (k) {
          var el = state.layers[k];
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        state.layers = null;
      }
      state.mounted = false;
    },

    isMounted: function () { return state.mounted; },
  };

  window.MahimaSTPM = MahimaSTPM;
})();
