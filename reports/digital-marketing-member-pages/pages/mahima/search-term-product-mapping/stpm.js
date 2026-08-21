/* stpm.js — REQ-DM-2026-08-MAHI01
   Mahima · Search Term → Product Mapping — browser controller.

   Contract with the server
   ------------------------
   All data arrives through /api/requirement?fn=mahima-stpm-*. The page holds
   no credentials: the session travels as the HttpOnly dm_session cookie, and
   no database connection string is ever visible here or in any response.

   Why filtering/sorting/paging are server-side
   --------------------------------------------
   A run can hold thousands of rows (measured: ~4.4k for a 30-day window).
   Shipping all of it to sort in the browser would be a multi-MB payload on a
   function that already has payload pressure. The table asks the server for
   one page at a time. */

'use strict';

(function () {
  var API = '/api/requirement?fn=';

  var state = {
    meta: null,
    runId: null,
    run: null,
    rows: [],
    total: 0,
    offset: 0,
    limit: 50,
    sort: 'cost',
    dir: 'desc',
    busy: false,
    selectedRow: null,
    lastFocus: null,
  };

  var $ = function (id) { return document.getElementById(id); };

  // ── transport ────────────────────────────────────────────────────────────
  function api(fn, opts) {
    var o = opts || {};
    var url = API + encodeURIComponent(fn) + (o.query ? '&' + o.query : '');
    var init = {
      method: o.method || 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    };
    if (o.body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(o.body);
    }
    return fetch(url, init).then(function (res) {
      if (res.status === 401) {
        throw withCode('Your session has expired. Please sign in again.', 'UNAUTHORISED');
      }
      return res.json().catch(function () {
        throw new Error('The server returned an unexpected response.');
      }).then(function (data) {
        if (!res.ok || data.ok === false) {
          throw withCode(data.error || 'Request failed.', data.code);
        }
        return data;
      });
    });
  }

  function withCode(msg, code) { var e = new Error(msg); e.code = code; return e; }

  // ── small helpers ────────────────────────────────────────────────────────
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nOrDash(v, dp) {
    if (v === null || v === undefined || v === '') return '—';
    var n = Number(v);
    if (!isFinite(n)) return '—';
    return n.toLocaleString('en-GB', {
      minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0,
    });
  }
  function money(v) {
    if (v === null || v === undefined || v === '') return '—';
    return '€' + Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(v) {
    if (v === null || v === undefined || v === '') return '—';
    return Number(v).toFixed(2) + '%';
  }
  function ratio(v) {
    if (v === null || v === undefined || v === '') return '—';
    return Number(v).toFixed(2);
  }
  function dateStr(v) { return v ? String(v).slice(0, 10) : '—'; }
  function dateTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function toast(msg, tone) {
    var t = $('toast');
    t.textContent = msg;
    t.setAttribute('data-tone', tone || 'ok');
    t.setAttribute('data-open', 'true');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.setAttribute('data-open', 'false'); }, 4200);
  }

  // ── source health ────────────────────────────────────────────────────────
  var HEALTH_ICON = { healthy: '✓', fallback: '!', stale_ingestion: '!', no_data: '×', idle: '•' };

  function renderHealth(run, metaFreshness) {
    var el = $('health');
    var warnings = (run && run.source_warnings) || [];
    var stateKey = (run && run.source_health) || 'idle';

    el.setAttribute('data-state', stateKey);
    $('healthIcon').textContent = HEALTH_ICON[stateKey] || '•';

    // The fallback message is the one the operator must not miss, so it is
    // promoted to the headline whenever it applies.
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

    $('healthTitle').textContent = title;
    $('healthMsg').textContent = msg;

    // Requested vs actual is always visible when a run exists — this is what
    // stops 14-day data being read as 7-day data.
    var ranges = $('healthRanges');
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
    } else {
      ranges.hidden = true;
    }

    var det = $('healthDetails');
    if (warnings.length) {
      $('healthDetail').innerHTML = warnings.map(renderWarning).join('');
      det.hidden = false;
    } else {
      det.hidden = true;
      det.open = false;
    }
  }

  function renderWarning(w) {
    var html = '<div class="grp"><div class="grp-t">' + esc(w.title) + '</div>' +
               '<div style="color:var(--ink-soft);margin-top:3px">' + esc(w.message) + '</div>';
    var d = w.detail || {};
    if (Array.isArray(d.campaigns) && d.campaigns.length) {
      html += '<ul>' + d.campaigns.slice(0, 20).map(function (c) {
        return '<li>' + esc(c.campaign_name) +
          (c.latest_date ? ' — latest data ' + esc(dateStr(c.latest_date)) : ' — no data on record') + '</li>';
      }).join('') + '</ul>';
      if (d.campaigns.length > 20) {
        html += '<div style="color:var(--muted-faint);margin-top:4px">…and ' + (d.campaigns.length - 20) + ' more.</div>';
      }
    }
    if (d.lag_days) {
      html += '<ul><li>Campaign totals current to ' + esc(dateStr(d.campaign_source_date)) + '</li>' +
              '<li>Search-term detail only to ' + esc(dateStr(d.search_term_source_date)) + '</li>' +
              '<li>Difference: ' + esc(d.lag_days) + ' days</li></ul>';
    }
    return html + '</div>';
  }

  // ── metadata + campaign picker ───────────────────────────────────────────
  function loadMetadata() {
    return api('mahima-stpm-metadata').then(function (m) {
      state.meta = m;
      $('scopeChip').hidden = false;

      var list = $('campaignList');
      var fCamp = $('fCampaign');
      list.innerHTML = '';

      (m.campaigns || []).forEach(function (c) {
        var id = 'c_' + c.campaign_id;
        var label = document.createElement('label');
        label.setAttribute('for', id);
        label.innerHTML =
          '<input type="checkbox" id="' + esc(id) + '" value="' + esc(c.campaign_id) + '" checked>' +
          '<span class="nm">' + esc(c.campaign_name) + '</span>' +
          '<span class="ty">' + esc((c.campaign_type || '').replace('PERFORMANCE_MAX', 'PMAX')) + '</span>';
        list.appendChild(label);

        var opt = document.createElement('option');
        opt.value = c.campaign_id;
        opt.textContent = c.campaign_name;
        fCamp.appendChild(opt);
      });

      list.addEventListener('change', updateCampaignSummary);
      updateCampaignSummary();
      renderHealth(null, m.freshness);
      return m;
    });
  }

  function selectedCampaigns() {
    return Array.prototype.slice
      .call(document.querySelectorAll('#campaignList input:checked'))
      .map(function (i) { return i.value; });
  }

  function updateCampaignSummary() {
    var total = document.querySelectorAll('#campaignList input').length;
    var sel = selectedCampaigns().length;
    $('campaignSummary').textContent =
      sel === total ? 'All ' + total + ' campaigns' : sel + ' of ' + total + ' campaigns';
    $('runBtn').disabled = sel === 0 || state.busy;
  }

  // ── run ──────────────────────────────────────────────────────────────────
  function currentInput() {
    var p = $('currentPreset').value;
    if (p === 'custom') return { preset: 'custom', start: $('currentStart').value, end: $('currentEnd').value };
    return { preset: 'last7' };
  }
  function historicalInput() {
    var p = $('histPreset').value;
    if (p === 'custom') return { preset: 'custom', start: $('histStart').value, end: $('histEnd').value };
    return { preset: p };
  }

  function setBusy(on) {
    state.busy = on;
    var btn = $('runBtn');
    btn.disabled = on || selectedCampaigns().length === 0;
    $('runBtnLabel').textContent = on ? 'Running…' : 'Run now';
    var sp = btn.querySelector('.spinner');
    if (on && !sp) btn.insertBefore(Object.assign(document.createElement('span'), { className: 'spinner' }), btn.firstChild);
    if (!on && sp) sp.remove();
  }

  function runNow() {
    if (state.busy) return;               // guards against double-click
    var campaigns = selectedCampaigns();
    if (!campaigns.length) { toast('Select at least one campaign.', 'error'); return; }

    setBusy(true);
    $('resultsState').innerHTML =
      '<h3>Running…</h3><p>Reading search-term data, applying the waste rules and matching Shopify products. ' +
      'This can take a moment for a long period.</p>';
    $('resultsState').hidden = false;
    $('tableWrap').hidden = true;
    $('pager').hidden = true;

    api('mahima-stpm-run', {
      method: 'POST',
      body: {
        campaign_ids: campaigns,
        current: currentInput(),
        historical: historicalInput(),
        // Server-side unique key: a retry or a double submit converges on one run.
        idempotency_key: 'stpm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
      },
    }).then(function (out) {
      state.runId = out.run.run_id;
      state.run = out.run;
      state.offset = 0;
      renderHealth(out.run);
      renderTiles(out.run);
      return loadResults();
    }).then(function () {
      loadHistory();
      toast('Run complete.');
    }).catch(function (err) {
      showError(err);
    }).then(function () {
      setBusy(false);
    });
  }

  function showError(err) {
    $('tableWrap').hidden = true;
    $('pager').hidden = true;
    $('filters').hidden = true;
    var s = $('resultsState');
    s.hidden = false;
    s.innerHTML = '<h3>' + esc(err.message || 'Something went wrong.') + '</h3>' +
      '<p>' + (err.code === 'UNAUTHORISED'
        ? 'Open the dashboard again to sign in, then retry.'
        : 'If this keeps happening, contact the technical team.') + '</p>';
    toast(err.message || 'Request failed.', 'error');
  }

  // ── tiles ────────────────────────────────────────────────────────────────
  function renderTiles(run) {
    var tiles = [
      { k: 'Search terms', v: nOrDash(run.row_count), s: null },
      { k: 'Spend', v: money(run.total_cost), s: 'in period shown' },
      { k: 'Conversions', v: nOrDash(run.total_conversions, 2),
        s: 'vs ' + nOrDash(run.historical_conversions_total, 2) + ' historical' },
      { k: 'Negative candidates', v: nOrDash(run.negative_candidate_count), tone: 'critical', s: 'need review' },
      { k: 'Opportunities', v: nOrDash(run.opportunity_count), tone: 'info', s: 'incl. candidates' },
      { k: 'Product matches', v: nOrDash(run.product_match_count), tone: 'positive',
        s: 'of ' + nOrDash(run.row_count) + ' terms' },
    ];
    $('tiles').innerHTML = tiles.map(function (t) {
      return '<div class="card tile"' + (t.tone ? ' data-tone="' + t.tone + '"' : '') + '>' +
        '<span class="k">' + esc(t.k) + '</span>' +
        '<span class="v">' + esc(t.v) + '</span>' +
        (t.s ? '<span class="s">' + esc(t.s) + '</span>' : '') + '</div>';
    }).join('');
    $('tiles').hidden = false;
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
    $('gridHead').innerHTML = COLUMNS.map(function (c) {
      var cls = (c.sticky ? 'sticky-l ' : '') + (c.n ? 'n ' : '') + (c.sort ? 'sortable' : '');
      var dir = state.sort === c.sort ? '<span class="dir">' + (state.dir === 'asc' ? '▲' : '▼') + '</span>' : '';
      var attrs = c.sort
        ? ' data-sort="' + esc(c.sort) + '" tabindex="0" role="button"' +
          ' aria-sort="' + (state.sort === c.sort ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '"'
        : '';
      return '<th class="' + cls.trim() + '"' + attrs + '>' + esc(c.label) + dir + '</th>';
    }).join('');
  }

  function chip(text, kind) {
    if (!text) return '<span class="chip chip-none">—</span>';
    return '<span class="chip chip-' + kind + '">' + esc(text) + '</span>';
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

  function cellFor(col, r) {
    switch (col.key) {
      case 'search_term':
        return '<div class="term">' + esc(r.search_term) +
          (needsAttention(r) ? '<span class="attn" title="Flagged for review"></span>' : '') + '</div>' +
          '<div class="term-sub">' + esc(dateStr(r.source_start)) + ' → ' + esc(dateStr(r.source_end)) + '</div>';
      case 'campaign':
        return '<div>' + esc(r.campaign_name || '—') + '</div>' +
          '<div class="term-sub">' + esc((r.campaign_type || '').replace('PERFORMANCE_MAX', 'PMax')) + '</div>';
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
        return '<span class="chip chip-none">No</span>';
      case 'product':
        if (!r.product_id) return '<span class="nomatch">No match</span>';
        return '<div class="prod">' +
          (r.product_url
            ? '<a href="' + esc(r.product_url) + '" target="_blank" rel="noopener">' + esc(r.product_title || r.product_id) + '</a>'
            : esc(r.product_title || r.product_id)) +
          '<div class="pid">' + esc(r.product_id) + '</div></div>';
      case 'match_type': return r.match_type ? esc(r.match_type) : '—';
      case 'match_score': return r.match_score === null || r.match_score === undefined ? '—' : ratio(r.match_score);
      case 'mapping_status': return mappingChip(r.mapping_status);
      case 'review_status': return reviewChip(r.review_status);
      default: return '—';
    }
  }

  function needsAttention(r) {
    var b = r.decision_basis;
    return !!(b && b.needs_attention);
  }

  function renderRows() {
    if (!state.rows.length) {
      $('tableWrap').hidden = true;
      $('pager').hidden = true;
      var s = $('resultsState');
      s.hidden = false;
      s.innerHTML = state.total === 0 && !hasFilters()
        ? '<h3>No search terms in this run</h3><p>' +
            esc(($('healthMsg').textContent) || 'No rows were produced for the selected period.') + '</p>'
        : '<h3>No rows match these filters</h3><p>Try clearing one or more filters.</p>' +
          '<button class="btn" type="button" onclick="document.getElementById(\'clearFilters\').click()">Clear all filters</button>';
      return;
    }

    $('resultsState').hidden = true;
    $('tableWrap').hidden = false;
    $('pager').hidden = false;

    $('gridBody').innerHTML = state.rows.map(function (r, i) {
      return '<tr data-i="' + i + '" tabindex="0" aria-selected="false">' +
        COLUMNS.map(function (c) {
          return '<td class="' + (c.sticky ? 'sticky-l ' : '') + (c.n ? 'num' : '') + '">' + cellFor(c, r) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    var from = state.offset + 1;
    var to = state.offset + state.rows.length;
    $('pagerInfo').textContent = 'Showing ' + from + '–' + to + ' of ' + state.total.toLocaleString('en-GB') + ' terms';
    $('prevPage').disabled = state.offset === 0;
    $('nextPage').disabled = to >= state.total;
    $('resultsBadge').textContent = state.total ? state.total.toLocaleString('en-GB') : '';
  }

  function hasFilters() { return activeFilterCount() > 0; }

  function filterQuery() {
    var q = [];
    var add = function (k, v) { if (v) q.push(k + '=' + encodeURIComponent(v)); };
    add('search', $('fSearch').value.trim());
    add('campaign_id', $('fCampaign').value);
    add('decision', $('fDecision').value);
    add('performance_status', $('fStatus').value);
    add('mapping_status', $('fMapping').value);
    add('review_status', $('fReview').value);
    add('product', $('fProduct').value.trim());
    return q.join('&');
  }

  function activeFilterCount() {
    return ['fSearch', 'fCampaign', 'fDecision', 'fStatus', 'fMapping', 'fReview', 'fProduct']
      .filter(function (id) { return $(id).value.trim() !== ''; }).length;
  }

  function syncFilterChrome() {
    var n = activeFilterCount();
    $('filterCount').textContent = n + (n === 1 ? ' filter' : ' filters');
    $('filterCount').hidden = n === 0;
    $('clearFilters').hidden = n === 0;
  }

  function loadResults() {
    if (!state.runId) return Promise.resolve();
    var q = 'run_id=' + encodeURIComponent(state.runId) +
      '&limit=' + state.limit + '&offset=' + state.offset +
      '&sort=' + encodeURIComponent(state.sort) + '&dir=' + state.dir;
    var f = filterQuery();
    if (f) q += '&' + f;

    return api('mahima-stpm-run-detail', { query: q }).then(function (d) {
      state.run = d.run;
      state.rows = d.rows || [];
      state.total = d.total || 0;
      $('filters').hidden = false;
      syncFilterChrome();
      renderHead();
      renderRows();
    }).catch(showError);
  }

  // ── drawer ───────────────────────────────────────────────────────────────
  function openDrawer(i) {
    var r = state.rows[i];
    if (!r) return;
    state.selectedRow = r;
    state.lastFocus = document.activeElement;

    Array.prototype.forEach.call(document.querySelectorAll('#gridBody tr'), function (tr) {
      tr.setAttribute('aria-selected', tr.getAttribute('data-i') === String(i) ? 'true' : 'false');
    });

    $('drawerTitle').textContent = r.search_term;
    $('drawerSub').textContent =
      (r.campaign_name || '—') + ' · ' + dateStr(r.source_start) + ' → ' + dateStr(r.source_end);
    $('drawerBody').innerHTML = drawerHtml(r);

    var d = $('drawer');
    d.hidden = false;
    // Next frame so the transform transition actually runs.
    requestAnimationFrame(function () {
      d.setAttribute('data-open', 'true');
      $('scrim').setAttribute('data-open', 'true');
      d.focus();
    });

    Array.prototype.forEach.call(d.querySelectorAll('[data-review]'), function (b) {
      b.addEventListener('click', function () { setReview(r, b.getAttribute('data-review')); });
    });
  }

  function closeDrawer() {
    var d = $('drawer');
    d.setAttribute('data-open', 'false');
    $('scrim').setAttribute('data-open', 'false');
    setTimeout(function () { d.hidden = true; }, 200);
    Array.prototype.forEach.call(document.querySelectorAll('#gridBody tr'), function (tr) {
      tr.setAttribute('aria-selected', 'false');
    });
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  function drawerHtml(r) {
    var h = '';

    // Performance
    h += '<div class="sec"><h3>Performance</h3><dl class="kv">' +
      kv('Clicks', nOrDash(r.clicks)) +
      kv('Impressions', nOrDash(r.impressions)) +
      kv('CTR', pct(r.ctr)) +
      kv('Cost', money(r.cost)) +
      kv('Conversions', nOrDash(r.conversions, 2)) +
      kv('Conversion value', money(r.conversion_value)) +
      kv('ROAS', ratio(r.roas)) +
      '</dl></div>';

    // Current vs historical — the approved comparison. No time-series chart:
    // the bucket granularity (daily/weekly/monthly) is not ratified yet.
    h += '<div class="sec"><h3>Current vs historical</h3><dl class="kv">' +
      kv('Conversions now', nOrDash(r.conversions, 2)) +
      kv('Conversions before', nOrDash(r.historical_conversions, 2)) +
      kv('Spend before', money(r.historical_cost)) +
      kv('Value before', money(r.historical_conversion_value)) +
      kvTxt('Performance status', r.performance_status) +
      '</dl></div>';

    // Why this decision
    h += '<div class="sec"><h3>Why this decision</h3>';
    var wr = Array.isArray(r.waste_reasons) ? r.waste_reasons : [];
    if (wr.length) {
      h += wr.map(function (w) {
        return '<div class="rule"><b>' + esc(w.label || w.rule) + '</b>' +
          (w.explain ? '<div class="why">' + esc(w.explain) + '</div>' : '') +
          (w.outcome ? '<div class="out">Rule outcome: ' + esc(w.outcome) + '</div>' : '') + '</div>';
      }).join('');
    } else {
      h += '<div class="note">No waste rule fired for this term.</div>';
    }
    h += '<dl class="kv" style="margin-top:9px">' + kvTxt('Decision', r.decision) +
      kvTxt('Negative recommended', r.negative_keyword_recommended ? 'Yes' : 'No') + '</dl>';

    var basis = r.decision_basis || {};
    if (basis.reason) h += '<div class="note" style="margin-top:9px">' + esc(basis.reason) + '</div>';
    if (basis.multiple_rules_fired) {
      h += '<div class="note warn" style="margin-top:7px">Several rules fired for this term. ' +
        'The order in which conflicting rules should win has not been confirmed by the business, ' +
        'so every rule is listed above rather than one being chosen automatically.</div>';
    }

    // Opportunity
    if (r.keyword_opportunity || r.opportunity_candidate) {
      h += '<div class="sec"><h3>Opportunity</h3>' +
        '<dl class="kv">' + kvTxt('Status', r.keyword_opportunity ? 'Confirmed opportunity' : 'Candidate — manual validation required') + '</dl>' +
        (r.opportunity_reason ? '<div class="note" style="margin-top:8px">' + esc(r.opportunity_reason) + '</div>' : '') +
        '</div>';
    }
    h += '</div>';

    // Product match evidence
    h += '<div class="sec"><h3>Product match</h3>';
    if (r.product_id) {
      var ev = r.match_evidence || {};
      h += '<dl class="kv">' +
        kvTxt('Product', r.product_title || '—') +
        kv('Product ID', r.product_id) +
        kvTxt('Match type', r.match_type) +
        kvTxt('Matched on', ev.source_label || r.match_source || '—') +
        kv('Score', r.match_score === null || r.match_score === undefined ? '—' : ratio(r.match_score)) +
        (r.runner_up_score !== null && r.runner_up_score !== undefined ? kv('Runner-up score', ratio(r.runner_up_score)) : '') +
        kvTxt('Mapping status', r.mapping_status) +
        '</dl>';
      if (ev.matched_text) {
        h += '<div class="note" style="margin-top:9px"><b>Matched text</b><br>' + esc(ev.matched_text) + '</div>';
      }
      if (r.product_url) {
        h += '<div style="margin-top:9px"><a href="' + esc(r.product_url) + '" target="_blank" rel="noopener">Open product on ledsone.de →</a></div>';
      }
    } else {
      h += '<div class="note">No product matched with enough evidence, so no product was assigned. ' +
        'A term is left unmatched rather than being forced onto the closest product.</div>';
    }
    if (r.mapping_reason) h += '<div class="sep-label">' + esc(r.mapping_reason) + '</div>';
    h += '</div>';

    // Data quality — shown only when it actually applies
    var flags = Array.isArray(r.data_quality_flags) ? r.data_quality_flags : [];
    if (flags.length) {
      h += '<div class="sec"><h3>Data quality</h3><div class="note warn">' +
        flags.map(function (f) {
          if (f.code === 'meta_title_missing') return 'This product has no Meta Title in Shopify; matching used the remaining fields.';
          if (f.code === 'meta_description_missing') return 'This product has no Meta Description in Shopify; matching used the remaining fields.';
          if (f.code === 'cost_missing') return 'Cost was not reported for this term, so cost-based rules were not evaluated for it.';
          if (f.code === 'intent_coverage_limited') return f.note || 'Intent coverage limited — review recommended.';
          return esc(f.code);
        }).map(esc).join('<br>') + '</div></div>';
    }

    // Human review — visibly separate from the system recommendation
    var rs = r.review_status || 'Pending';
    h += '<div class="sec"><h3>Human review</h3>' +
      '<div class="sep-label" style="margin:0 0 8px">System recommendation: <strong>' + esc(r.decision) +
      '</strong>. Changing the review below does not change it.</div>' +
      '<div class="review-row">' +
      ['Pending', 'Approved', 'Rejected'].map(function (v) {
        return '<button class="btn" type="button" data-review="' + v + '" aria-pressed="' +
          (rs === v ? 'true' : 'false') + '">' + v + '</button>';
      }).join('') + '</div>' +
      (r.reviewer ? '<div class="sep-label">Last changed by ' + esc(r.reviewer) + ' on ' + esc(dateTime(r.reviewed_at)) + '.</div>' : '') +
      '</div>';

    return h;
  }

  function kv(k, v) { return '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>'; }
  function kvTxt(k, v) { return '<dt>' + esc(k) + '</dt><dd class="txt">' + esc(v === null || v === undefined ? '—' : v) + '</dd>'; }

  function setReview(row, value) {
    api('mahima-stpm-review', {
      method: 'POST',
      body: { result_id: row.result_id, review_status: value },
    }).then(function () {
      // Only reflect the change after the server confirms it.
      row.review_status = value;
      Array.prototype.forEach.call(document.querySelectorAll('#drawer [data-review]'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-review') === value ? 'true' : 'false');
      });
      renderRows();
      toast('Review set to ' + value + '.');
    }).catch(function (err) { toast(err.message || 'Could not save the review.', 'error'); });
  }

  // ── history ──────────────────────────────────────────────────────────────
  function loadHistory() {
    return api('mahima-stpm-runs', { query: 'limit=10' }).then(function (d) {
      var runs = d.runs || [];
      $('historyBadge').textContent = runs.length ? String(runs.length) : '';
      if (!runs.length) {
        $('historyState').innerHTML = '<h3>No runs yet</h3><p>Runs appear here once you use Run now.</p>';
        $('historyState').hidden = false;
        $('runs').hidden = true;
        return;
      }
      $('historyState').hidden = true;
      $('runs').hidden = false;
      $('runs').innerHTML = runs.map(function (r) {
        var badge = r.status === 'FAILED' ? chip('Failed', 'negative')
          : r.fallback_used ? chip('14-day fallback', 'manual')
          : r.source_health === 'stale_ingestion' ? chip('Stale source', 'manual')
          : r.row_count === 0 ? chip('No data', 'none')
          : chip('Complete', 'approved');
        return '<button class="run" type="button" data-run="' + esc(r.run_id) + '">' +
          '<div class="run-main">' +
            '<div class="run-t"><span class="run-no">#' + esc(r.run_no) + '</span>' +
              '<span class="run-when">' + esc(dateTime(r.created_at)) + '</span>' + badge + '</div>' +
            '<div class="run-meta">' +
              '<span>Requested <b>' + esc(dateStr(r.requested_start)) + ' → ' + esc(dateStr(r.requested_end)) + '</b></span>' +
              '<span>Showing <b>' + esc(dateStr(r.actual_start)) + ' → ' + esc(dateStr(r.actual_end)) + '</b></span>' +
              '<span>Compared with <b>' + esc(dateStr(r.historical_start)) + ' → ' + esc(dateStr(r.historical_end)) + '</b></span>' +
            '</div>' +
            '<div class="run-meta">' +
              '<span>' + esc(r.campaigns_with_data) + ' of ' + esc(r.campaigns_selected) + ' campaigns had data</span>' +
              '<span>Source to <b>' + esc(dateStr(r.latest_search_term_source_date)) + '</b></span>' +
              '<span>By ' + esc(r.created_by) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="run-stats">' +
            stat(r.row_count, 'Terms') +
            stat(r.negative_candidate_count, 'Negative') +
            stat(r.opportunity_count, 'Opps') +
          '</div></button>';
      }).join('');

      Array.prototype.forEach.call(document.querySelectorAll('#runs [data-run]'), function (b) {
        b.addEventListener('click', function () { openRun(b.getAttribute('data-run')); });
      });
    }).catch(function (err) {
      $('historyState').innerHTML = '<h3>' + esc(err.message) + '</h3>';
      $('historyState').hidden = false;
    });
  }

  function stat(v, k) {
    return '<div class="run-stat"><span class="v">' + esc(nOrDash(v)) + '</span><span class="k">' + esc(k) + '</span></div>';
  }

  /* Opening a past run reads its STORED snapshot — it is never recomputed from
     today's Ledsone data, so an old run keeps showing what the operator saw. */
  function openRun(runId) {
    state.runId = runId;
    state.offset = 0;
    clearFilters(true);
    showTab('results');
    return loadResults().then(function () {
      if (state.run) { renderHealth(state.run); renderTiles(state.run); }
      toast('Showing the stored results for run #' + (state.run ? state.run.run_no : '') + '.');
    });
  }

  // ── tabs ─────────────────────────────────────────────────────────────────
  function showTab(which) {
    var isResults = which === 'results';
    $('tabResults').setAttribute('aria-selected', String(isResults));
    $('tabHistory').setAttribute('aria-selected', String(!isResults));
    $('panelResults').hidden = !isResults;
    $('panelHistory').hidden = isResults;
  }

  function clearFilters(silent) {
    ['fSearch', 'fCampaign', 'fDecision', 'fStatus', 'fMapping', 'fReview', 'fProduct']
      .forEach(function (id) { $(id).value = ''; });
    syncFilterChrome();
    if (!silent) { state.offset = 0; loadResults(); }
  }

  // ── downloads ────────────────────────────────────────────────────────────
  function download(type) {
    if (!state.runId) { toast('Run the report first.', 'error'); return; }
    var q = 'run_id=' + encodeURIComponent(state.runId) + '&type=' + type;
    var f = filterQuery();
    if (f) q += '&' + f;
    // A normal navigation so the browser handles Content-Disposition itself.
    window.location.href = API + 'mahima-stpm-export&' + q;
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function init() {
    $('runBtn').addEventListener('click', runNow);

    $('currentPreset').addEventListener('change', function () {
      $('currentCustom').hidden = this.value !== 'custom';
    });
    $('histPreset').addEventListener('change', function () {
      $('histCustom').hidden = this.value !== 'custom';
    });

    $('tabResults').addEventListener('click', function () { showTab('results'); });
    $('tabHistory').addEventListener('click', function () { showTab('history'); loadHistory(); });

    // Sort: click or keyboard on a header cell.
    $('gridHead').addEventListener('click', onSort);
    $('gridHead').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(e); }
    });
    function onSort(e) {
      var th = e.target.closest('th[data-sort]');
      if (!th) return;
      var key = th.getAttribute('data-sort');
      if (state.sort === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort = key; state.dir = 'desc'; }
      state.offset = 0;
      loadResults();
    }

    // Row open: click or keyboard.
    $('gridBody').addEventListener('click', function (e) {
      if (e.target.closest('a')) return;               // let product links work
      var tr = e.target.closest('tr[data-i]');
      if (tr) openDrawer(Number(tr.getAttribute('data-i')));
    });
    $('gridBody').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tr = e.target.closest('tr[data-i]');
      if (tr) { e.preventDefault(); openDrawer(Number(tr.getAttribute('data-i'))); }
    });

    $('drawerClose').addEventListener('click', closeDrawer);
    $('scrim').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('drawer').getAttribute('data-open') === 'true') closeDrawer();
    });

    var reload = debounce(function () { state.offset = 0; syncFilterChrome(); loadResults(); }, 260);
    ['fSearch', 'fProduct'].forEach(function (id) { $(id).addEventListener('input', reload); });
    ['fCampaign', 'fDecision', 'fStatus', 'fMapping', 'fReview'].forEach(function (id) {
      $(id).addEventListener('change', function () { state.offset = 0; syncFilterChrome(); loadResults(); });
    });
    $('clearFilters').addEventListener('click', function () { clearFilters(false); });

    $('pageSize').addEventListener('change', function () {
      state.limit = Number(this.value) || 50;
      state.offset = 0;
      loadResults();
    });
    $('prevPage').addEventListener('click', function () {
      state.offset = Math.max(0, state.offset - state.limit); loadResults();
    });
    $('nextPage').addEventListener('click', function () {
      state.offset = state.offset + state.limit; loadResults();
    });

    $('dlFull').addEventListener('click', function () { download('full'); });
    $('dlNeg').addEventListener('click', function () { download('negative'); });
    $('dlOpp').addEventListener('click', function () { download('opportunity'); });

    // First paint asks only for metadata and the run list — the expensive
    // Ledsone work happens on Run now, never on page load.
    loadMetadata()
      .then(loadHistory)
      .catch(function (err) {
        $('health').setAttribute('data-state', 'no_data');
        $('healthTitle').textContent = err.message || 'Could not load this view.';
        $('healthMsg').textContent = err.code === 'UNAUTHORISED'
          ? 'Open the dashboard again to sign in, then reload this page.'
          : 'If this keeps happening, contact the technical team.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
