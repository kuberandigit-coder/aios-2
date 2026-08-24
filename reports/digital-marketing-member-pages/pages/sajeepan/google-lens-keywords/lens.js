/* lens.js — REQ-DM-2026-08-SAJE01
   Sajeepan · Automation Keyword Finder — browser controller.

   MOUNT MODEL
   -----------
   Not a standalone page. sajeepan.html stays the persistent shell (sidebar,
   header, tab bar); this view is injected into the Requirement 5 panel.
   Public surface, same shape as window.MahimaSTPM:

       window.SajeepanLensKeywords.mount(rootElement)   // idempotent
       window.SajeepanLensKeywords.unmount()             // releases drawer/scrim

   Contract with the server
   -------------------------
   All data arrives through /api/members-api?member=sajeepan&type=lens-keyword-*.
   The page holds no credentials: the session travels as the HttpOnly
   dm_session cookie. No SerpAPI key, generation key, connection string, or raw
   provider response is ever visible here.

   FULLY AUTOMATIC WORKFLOW
   ------------------------
   There is ONE action: Run Automation Now. It runs the same workflow the
   weekly cron runs. Product selection, competitor filtering, keyword choice,
   validation and copy generation are all decided server-side and shown here
   with their reasons. The eight tabs are for INSPECTION — the automation
   moves through them on its own; clicking a tab never advances or re-runs
   anything.

   ZERO-PROVIDER-CALL READS
   ------------------------
   Filtering the product table, switching tabs, opening a past run and
   reloading history are all pure reads of stored data. None of them can
   trigger a SerpAPI search.

   RESUME-ON-REFRESH
   ------------------
   The active run id is kept in localStorage (per-browser convenience only,
   never authoritative — the server's run row is authoritative). On mount, an
   in-progress run resumes being driven rather than being started again. */

'use strict';

(function () {
  var API = '/api/members-api?member=sajeepan&type=';
  var STORAGE_KEY = 'lensActiveRunId';

  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf('lens.js') !== -1) { s = all[i].src; break; }
      }
    }
    return s ? s.replace(/[^/]*$/, '') : 'sajeepan/google-lens-keywords/';
  })();

  var state = {
    mounted: false, root: null,
    allProducts: [], productCounts: null, maxProducts: 50,
    plan: null, schedule: null,
    runId: null, run: null, runProducts: [],
    driving: false, cancelDrive: false,
    competitors: [], activeSku: null,
    reportSku: null, report: null, generation: null,
    lastFocus: null,
  };

  function $(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }

  // ── transport ────────────────────────────────────────────────────────────
  function api(type, opts) {
    var o = opts || {};
    var url = API + encodeURIComponent(type) + (o.query ? '&' + o.query : '');
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

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function dateTime(v) {
    if (!v) return '—';
    var d = new Date(v); if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function num(v) { return (v === null || v === undefined) ? '—' : String(v); }
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function emptyRow(cols, text) {
    return '<tr class="lens-empty-row"><td colspan="' + cols + '"><em>' + esc(text) + '</em></td></tr>';
  }
  function pill(text, tone) { return '<span class="lens-pill lens-pill-' + tone + '">' + esc(text) + '</span>'; }

  function toast(msg, tone) {
    var t = $('lensToast'); if (!t) return;
    t.textContent = msg;
    t.setAttribute('data-tone', tone || 'ok');
    t.setAttribute('data-open', 'true');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.setAttribute('data-open', 'false'); }, 4200);
  }

  // ── views ────────────────────────────────────────────────────────────────
  var VIEWS = ['products', 'competitors', 'phase1', 'phase2', 'ads', 'copy', 'final', 'history'];

  function showView(name) {
    VIEWS.forEach(function (v) {
      var el = $('lensView' + cap(v)); if (el) el.hidden = v !== name;
      var tab = $('lensTab' + cap(v));
      if (tab) { tab.classList.toggle('on', v === name); tab.setAttribute('aria-selected', v === name ? 'true' : 'false'); }
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function wireTabs() {
    VIEWS.forEach(function (v) {
      var tab = $('lensTab' + cap(v));
      if (!tab) return;
      // Switching tabs is inspection only — it reads stored data and can never
      // start, advance or re-run any part of the automation.
      tab.addEventListener('click', function () {
        showView(v);
        if (v === 'competitors') { renderRail('lensCompetitorRail', 'activeSku', loadCompetitors); loadCompetitors(); }
        else if (v === 'history') loadHistory();
        else if (v !== 'products') { renderRail(railIdFor(v), 'reportSku', loadReport); loadReport(); }
      });
    });
  }
  function railIdFor(v) {
    return { phase1: 'lensPhase1Rail', phase2: 'lensPhase2Rail', ads: 'lensAdsRail', copy: 'lensCopyRail', final: 'lensFinalRail' }[v];
  }

  // ── SCHEDULE STATUS ──────────────────────────────────────────────────────
  function loadSchedule() {
    return api('lens-keyword-weekly-status').then(function (data) {
      state.schedule = data;
      var s = data.schedule || {};
      var last = s.last_run;
      $('lensSchedEnabled').textContent = s.enabled ? 'Enabled' : 'Disabled';
      $('lensSchedWhen').textContent = s.schedule_human || s.schedule || '—';
      $('lensSchedLast').textContent = last ? dateTime(last.started_at) : 'Not run yet';
      $('lensSchedNext').textContent = dateTime(s.next_scheduled_run);
      $('lensSchedProducts').textContent = last ? num(last.products_selected) : '—';
      $('lensSchedStatus').textContent = last ? (last.status || '—') : '—';
      var c = data.search_cache || {};
      $('lensSchedCache').textContent = (c.fresh_entries || 0) + ' fresh entries · ' + (c.total_hits || 0) + ' reuses';
      $('lensSchedNote').textContent = (s.timezone_note || 'Scheduled times are UTC.') +
        ' A daily continuation check resumes an unfinished weekly run; it never starts a second one.';
    }).catch(function (err) {
      $('lensSchedEnabled').textContent = 'Unavailable';
      $('lensSchedNote').textContent = err.message || 'Could not read the automation schedule.';
    });
  }

  // ── RUN PLAN ─────────────────────────────────────────────────────────────
  function loadPlan() {
    return api('lens-keyword-run-plan').then(function (data) {
      state.plan = data.plan || {};
      renderPlan();
    }).catch(function (err) {
      var box = $('lensQuotaError');
      box.hidden = false;
      box.textContent = err.message || 'Could not check what this run would cost.';
      $('lensRunBtn').disabled = true;
    });
  }

  function renderPlan() {
    var p = state.plan || {};
    $('lensPlanSelected').textContent = num(p.products_selected);
    $('lensPlanLive').textContent = num(p.live_searches_needed);
    $('lensPlanCached').textContent = num(p.cached_searches_reused);
    $('lensPlanAvailable').textContent = num(p.serpapi_searches_available);
    $('lensPlanReserve').textContent = num(p.quota_reserve);

    var ready = $('lensPlanReady');
    var blocked = $('lensPlanBlocked');
    if (p.run_ready) {
      ready.hidden = false;
      ready.textContent = 'Ready — ' + p.products_selected + ' products, ' + p.live_searches_needed +
        ' live search(es) needed, ' + p.cached_searches_reused + ' reused from cache.';
      blocked.hidden = true;
      $('lensRunBtn').disabled = false;
    } else {
      ready.hidden = true;
      blocked.hidden = false;
      blocked.textContent = p.not_ready_reason || 'This run cannot start right now.';
      $('lensRunBtn').disabled = true;
    }
  }

  // ── 1. ALL PRODUCTS ──────────────────────────────────────────────────────
  function loadAllProducts() {
    var box = $('lensProductsState');
    box.hidden = true;
    return api('lens-keyword-all-products').then(function (data) {
      state.allProducts = data.products || [];
      state.productCounts = data.counts || {};
      state.maxProducts = data.max_products_per_run || 50;
      $('lensMaxProducts').textContent = state.maxProducts;
      var c = state.productCounts;
      $('lensProductsCounts').textContent =
        'Eligible products: ' + (c.eligible || 0) +
        ' → Automatically selected: ' + (c.selected || 0) +
        ' → Excluded due to missing required product data: ' + (c.excluded_ineligible || 0) +
        (c.excluded_capacity ? ' → Eligible but below the top ' + state.maxProducts + ': ' + c.excluded_capacity : '');
      renderProducts();
    }).catch(function (err) {
      box.hidden = false;
      box.innerHTML = '<h3>Could not load products</h3><p>' + esc(err.message) + '</p>';
    });
  }

  function filteredProducts() {
    var q = ($('lensSearchBox').value || '').trim().toLowerCase();
    var elig = $('lensFilterEligibility').value;
    return state.allProducts.filter(function (p) {
      if (elig && p.automation_eligibility !== elig) return false;
      if (!q) return true;
      return (p.sku || '').toLowerCase().indexOf(q) !== -1
        || (p.current_title || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderProducts() {
    var rows = filteredProducts();
    var body = qs('#lensProductsTable tbody');
    if (!rows.length) {
      body.innerHTML = emptyRow(13, 'No products match this filter.');
      return;
    }
    body.innerHTML = rows.map(function (p) {
      return '<tr>' +
        '<td>' + selectPill(p.select_status) + '</td>' +
        '<td>' + (p.image_url ? '<img class="lens-thumb-sm" src="' + esc(p.image_url) + '" alt="">' : '<em>None</em>') + '</td>' +
        '<td>' + esc(p.sku || '—') + '</td>' +
        '<td class="lens-cell-title">' + esc(p.current_title || '—') + '</td>' +
        '<td class="lens-cell-url">' + (p.product_url ? '<a href="' + esc(p.product_url) + '" target="_blank" rel="noopener">Open</a>' : '<em>None</em>') + '</td>' +
        '<td>' + statusPill(p.same_sku_status, ['RESOLVED']) + '</td>' +
        '<td>' + statusPill(p.image_status, ['VALID']) + '</td>' +
        '<td>' + statusPill(p.product_data_status, ['COMPLETE']) + '</td>' +
        '<td>' + statusPill(p.attribute_coverage, ['PRESENT']) + '</td>' +
        '<td>' + statusPill(p.google_ads_evidence, ['PRESENT']) + '</td>' +
        '<td>' + statusPill(p.automation_eligibility, ['SELECTED', 'ELIGIBLE']) + '</td>' +
        '<td class="lens-num">' + num(p.selection_score) + '</td>' +
        '<td class="lens-cell-reason">' + esc(p.selection_reason || '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function selectPill(s) {
    if (s === 'AUTO_SELECTED') return pill('Auto selected', 'ok');
    if (s === 'ELIGIBLE_NOT_SELECTED') return pill('Eligible', 'neutral');
    return pill('Excluded', 'bad');
  }
  function statusPill(value, goodValues) {
    if (!value) return '<em>—</em>';
    var tone = goodValues.indexOf(value) !== -1 ? 'ok' : (value === 'NONE' ? 'neutral' : 'warn');
    if (value === 'NOT_ELIGIBLE' || value === 'INCOMPLETE' || value === 'MISSING' || value === 'UNRESOLVED') tone = 'bad';
    return pill(humanise(value), tone);
  }
  function humanise(v) {
    return String(v).toLowerCase().replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function wireProductFilters() {
    // Both filters operate on data already in the browser — no request, and
    // therefore no possibility of a provider call.
    $('lensSearchBox').addEventListener('input', renderProducts);
    $('lensFilterEligibility').addEventListener('change', renderProducts);
  }

  // ── RUN THE AUTOMATION ───────────────────────────────────────────────────
  function runAutomation() {
    $('lensRunBtn').disabled = true;
    api('lens-keyword-run-automation', { method: 'POST', body: { idempotency_key: uuid() } })
      .then(function (data) {
        state.runId = data.run.run_id;
        try { localStorage.setItem(STORAGE_KEY, state.runId); } catch (e) { /* convenience only */ }
        toast('Automation started for ' + data.selected_count + ' product(s).', 'ok');
        driveRun();
      })
      .catch(function (err) {
        toast(err.message || 'Could not start the automation.', 'err');
        loadPlan();
      });
  }

  function driveRun() {
    if (!state.runId || state.driving) return;
    state.driving = true;
    state.cancelDrive = false;
    $('lensProgressPanel').hidden = false;
    step();

    function step() {
      if (state.cancelDrive) { state.driving = false; return; }
      api('lens-keyword-automation-advance', { method: 'POST', body: { run_id: state.runId } })
        .then(function (data) {
          renderProgress(data);
          if (data.complete) {
            state.driving = false;
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* convenience only */ }
            onRunFinished();
          } else {
            setTimeout(step, 300);
          }
        })
        .catch(function (err) {
          state.driving = false;
          $('lensProgressTitle').textContent = 'Automation paused';
          $('lensProgressSummary').textContent = err.message || 'The automation could not continue.';
        });
    }
  }

  function renderProgress(data) {
    $('lensProgressTitle').textContent = data.complete ? 'Automation complete' : 'Automation running';
    $('lensProgressStage').textContent = stageLabel(data);
    $('lensProgressLive').textContent = num(data.searches_used);
    $('lensProgressCached').textContent = num(data.cached_searches_used);

    return api('lens-keyword-run-status', { query: 'run_id=' + encodeURIComponent(state.runId) }).then(function (s) {
      state.run = s.run;
      state.runProducts = s.products || [];
      var total = state.runProducts.length;
      var done = state.runProducts.filter(function (p) { return p.state !== 'WAITING' && p.state !== 'RUNNING'; }).length;
      $('lensProgressDone').textContent = done + ' / ' + total;
      $('lensProgressSummary').textContent = data.complete
        ? 'Finished ' + total + ' product(s). Every stage below is filled in.'
        : 'Working through ' + total + ' product(s) automatically — no action needed.';
      $('lensProgressFill').style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
    }).catch(function () { /* the progress panel is non-critical */ });
  }

  function stageLabel(data) {
    if (data.complete) return 'Complete';
    if (data.analysis_status) return 'Keyword analysis';
    if (data.run_status) return 'Visual competitor search';
    return 'Starting';
  }

  function onRunFinished() {
    toast('Automation complete.', 'ok');
    loadPlan();
    loadSchedule();
    loadAllProducts();
    state.activeSku = null;
    state.reportSku = null;
    showView('competitors');
    renderRail('lensCompetitorRail', 'activeSku', loadCompetitors);
    loadCompetitors();
  }

  // ── rails (shared by every per-product tab) ──────────────────────────────
  function renderRail(railId, skuField, onPick) {
    var rail = $(railId);
    if (!rail) return;
    if (!state.runProducts.length) {
      rail.innerHTML = '<p class="lens-note">No run loaded yet.</p>';
      return;
    }
    if (!state[skuField]) state[skuField] = state.runProducts[0].sku;
    rail.innerHTML = state.runProducts.map(function (p) {
      var on = state[skuField] === p.sku ? ' on' : '';
      return '<button type="button" class="lens-rail-item' + on + '" data-sku="' + esc(p.sku) + '">' +
        esc(p.title || p.sku) + '<small>' + esc(p.sku) + (p.result_count != null ? ' · ' + p.result_count + ' results' : '') + '</small></button>';
    }).join('');
    Array.prototype.forEach.call(rail.querySelectorAll('.lens-rail-item'), function (btn) {
      btn.addEventListener('click', function () {
        state[skuField] = btn.getAttribute('data-sku');
        renderRail(railId, skuField, onPick);
        onPick();
      });
    });
  }

  // ── 2. COMPETITORS ───────────────────────────────────────────────────────
  function competitorFilters() {
    var f = ['limit=300', 'include_self=1', 'include_duplicates=1'];
    var dom = $('lensFilterDomain').value; if (dom) f.push('domain=' + encodeURIComponent(dom));
    if (state.activeSku) f.push('sku=' + encodeURIComponent(state.activeSku));
    return f.join('&');
  }

  function loadCompetitors() {
    if (!state.runId) return Promise.resolve();
    var box = $('lensCompetitorState');
    box.hidden = true;
    return api('lens-keyword-run-results', { query: 'run_id=' + encodeURIComponent(state.runId) + '&' + competitorFilters() })
      .then(function (data) {
        state.competitors = data.rows || [];
        state.run = data.run || state.run;
        renderCompetitorSummary();
        renderOurProduct();
        renderCompetitorTable();
      }).catch(function (err) {
        box.hidden = false;
        box.innerHTML = '<h3>Could not load competitor decisions</h3><p>' + esc(err.message) + '</p>';
      });
  }

  function renderCompetitorSummary() {
    var counts = {};
    state.competitors.forEach(function (r) {
      var d = r.auto_decision || 'UNDECIDED';
      counts[d] = (counts[d] || 0) + 1;
    });
    var order = ['AUTO_INCLUDED', 'AUTO_EXCLUDED_SELF', 'AUTO_EXCLUDED_DUPLICATE',
      'AUTO_EXCLUDED_MISSING_DATA', 'AUTO_EXCLUDED_IRRELEVANT', 'AUTO_EXCLUDED_ATTRIBUTE_CONFLICT'];
    $('lensCompetitorSummary').innerHTML = order.filter(function (k) { return counts[k]; }).map(function (k) {
      return pill(decisionLabel(k) + ': ' + counts[k], k === 'AUTO_INCLUDED' ? 'ok' : 'neutral');
    }).join('') || '<span class="lens-note">No competitor results captured yet.</span>';
  }

  function renderOurProduct() {
    var box = $('lensOurProduct');
    var p = state.runProducts.find(function (x) { return x.sku === state.activeSku; });
    if (!p) { box.innerHTML = '<em>Select a product to see its competitor decisions.</em>'; return; }
    box.innerHTML = (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="">' : '') +
      '<div><strong>' + esc(p.title || '') + '</strong><br><small>' + esc(p.sku) + '</small></div>';
  }

  function renderCompetitorTable() {
    var wanted = $('lensFilterDecision').value;
    var rows = state.competitors.filter(function (r) { return !wanted || r.auto_decision === wanted; });
    var body = qs('#lensCompetitorTable tbody');
    if (!rows.length) {
      body.innerHTML = emptyRow(8, 'No competitor results match this filter.');
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var reasons = Array.isArray(r.decision_reasons) ? r.decision_reasons.join(' ') : '';
      return '<tr>' +
        '<td class="lens-num">' + num(r.rank) + '</td>' +
        '<td>' + (r.image_src ? '<img class="lens-thumb-sm" src="' + esc(r.image_src) + '" alt="">' : '<em>None</em>') + '</td>' +
        '<td class="lens-cell-title">' + (r.url
          ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title || '(no title)') + '</a>'
          : esc(r.title || '(no title)')) + '</td>' +
        '<td>' + esc(r.displayed_domain || '—') + '</td>' +
        '<td>' + pill(decisionLabel(r.auto_decision), r.auto_decision === 'AUTO_INCLUDED' ? 'ok' : 'warn') + '</td>' +
        '<td class="lens-num">' + num(r.auto_score) + '</td>' +
        '<td class="lens-cell-reason">' + esc(reasons || '—') + '</td>' +
        '<td><button type="button" class="lens-btn lens-btn-ghost lens-btn-sm" data-evidence="' + r.competitor_result_id + '">View</button></td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('[data-evidence]'), function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-evidence'));
        var row = state.competitors.find(function (r) { return r.competitor_result_id === id; });
        if (row) openDrawer(row);
      });
    });
  }

  function decisionLabel(d) {
    return {
      AUTO_INCLUDED: 'Auto included',
      AUTO_EXCLUDED_SELF: 'Our own listing',
      AUTO_EXCLUDED_DUPLICATE: 'Duplicate',
      AUTO_EXCLUDED_MISSING_DATA: 'Missing data',
      AUTO_EXCLUDED_IRRELEVANT: 'Not relevant',
      AUTO_EXCLUDED_ATTRIBUTE_CONFLICT: 'Attribute conflict',
    }[d] || 'Undecided';
  }

  function wireCompetitorFilters() {
    $('lensFilterDecision').addEventListener('change', renderCompetitorTable);
    $('lensFilterDomain').addEventListener('input', debounceCompetitors);
    $('lensExportBtn').addEventListener('click', function () {
      if (!state.runId) return;
      window.open(API + 'lens-keyword-export&run_id=' + encodeURIComponent(state.runId) + '&' + competitorFilters(), '_blank');
    });
  }
  var domainDebounce = null;
  function debounceCompetitors() { clearTimeout(domainDebounce); domainDebounce = setTimeout(loadCompetitors, 300); }

  // ── 3-7. PER-PRODUCT REPORT ──────────────────────────────────────────────
  function loadReport() {
    if (!state.runId || !state.reportSku) return Promise.resolve();
    return api('lens-keyword-product-report', {
      query: 'run_id=' + encodeURIComponent(state.runId) + '&sku=' + encodeURIComponent(state.reportSku),
    }).then(function (data) {
      state.report = data;
      renderReport(data);
      return api('lens-keyword-generation', {
        query: 'run_id=' + encodeURIComponent(state.runId) + '&sku=' + encodeURIComponent(state.reportSku),
      }).then(function (g) { state.generation = g.generation; renderGeneration(); })
        .catch(function () { state.generation = null; renderGeneration(); });
    }).catch(function (err) {
      toast(err.message || 'Could not load this product’s analysis.', 'err');
    });
  }

  function renderReport(data) {
    // ── 3. Phase 1 keywords ──
    var p1 = (data.phase1_keywords || []).filter(function (k) { return !k.is_brand; }).slice(0, 15);
    $('lensPrimaryKeyword').textContent = 'Primary keyword: ' +
      ((data.product && data.product.phase1_primary_keyword) || 'not selected yet') +
      ' — chosen automatically as the highest distinct-title frequency non-brand term.';
    qs('#lensPhase1Table tbody').innerHTML = p1.map(function (k) {
      return '<tr><td>' + esc(k.term) + '</td><td>' + esc(k.category || '—') + '</td>' +
        '<td class="lens-num">' + num(k.title_frequency) + '</td>' +
        '<td class="lens-num">' + (k.title_frequency_pct == null ? '—' : k.title_frequency_pct + '%') + '</td>' +
        '<td>' + (k.in_current_title ? 'Yes' : 'No') + '</td>' +
        '<td>' + (k.is_brand ? pill('Brand — excluded', 'warn') : 'No') + '</td></tr>';
    }).join('') || emptyRow(6, 'No Phase 1 keywords for this product yet.');

    // ── 4. Phase 2 expansion ──
    var byEngine = {};
    (data.phase2_results || []).forEach(function (r) { (byEngine[r.engine] = byEngine[r.engine] || []).push(r); });
    var ENGINE_LABEL = { google: 'Google All', google_images: 'Google Images', google_shopping: 'Google Shopping' };
    $('lensPhase2Groups').innerHTML = Object.keys(ENGINE_LABEL).map(function (eng) {
      var items = (byEngine[eng] || []).slice(0, 10);
      return '<h4 class="lens-label">' + ENGINE_LABEL[eng] + '</h4>' + (items.length
        ? '<div class="lens-table-scroll"><table class="lens-table"><thead><tr><th scope="col" class="lens-num">Rank</th><th scope="col">Title</th><th scope="col">Domain</th><th scope="col">Price</th></tr></thead><tbody>' +
          items.map(function (r) {
            return '<tr><td class="lens-num">' + num(r.rank) + '</td><td class="lens-cell-title">' + esc(r.title || r.url || '—') +
              '</td><td>' + esc(r.displayed_domain || '—') + '</td><td>' + esc(r.price || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="lens-note">No results captured for this engine.</p>');
    }).join('');

    // ── 5. Ads evidence & attribute validation ──
    var planRows = data.planner_suggestions || [];
    var planState = $('lensPlannerState');
    if (planRows.length && planRows[0].status === 'BLOCKED_CONFIG_REQUIRED') {
      planState.hidden = false;
      planState.innerHTML = '<h3>Keyword Planner is not available</h3>' +
        '<p>Live Keyword Planner needs a Google Ads API credential that is not configured. Existing campaign keyword evidence below still applies, and the rest of the workflow continued normally.</p>';
    } else {
      planState.hidden = true;
    }
    qs('#lensPlannerTable tbody').innerHTML = planRows.map(function (s) {
      return '<tr><td>' + esc(s.seed_keyword) + '</td><td>' + esc(s.matched_keyword || s.new_suggestion || '—') + '</td>' +
        '<td class="lens-num">' + num(s.avg_monthly_searches) + '</td><td>' + esc(s.competition || '—') + '</td>' +
        '<td>' + (s.low_top_of_page_bid == null ? '—' : ('£' + s.low_top_of_page_bid + '–£' + s.high_top_of_page_bid)) + '</td>' +
        '<td>' + esc(s.status === 'FETCHED' || s.status === 'CACHED' ? 'Keyword Planner' : 'Not available') + '</td></tr>';
    }).join('') || emptyRow(6, 'No Keyword Planner data for this product.');

    qs('#lensAttributeTable tbody').innerHTML = (data.attribute_validation || []).map(function (v) {
      var tone = v.status === 'MATCHED_FACT' ? 'ok'
        : (v.status === 'CONFLICT' || v.status === 'BRAND_EXCLUDED') ? 'bad' : 'warn';
      return '<tr><td>' + esc(v.term) + '</td><td>' + esc(v.attribute_type || '—') + '</td>' +
        '<td>' + pill(humanise(v.status), tone) + '</td><td>' + esc(v.actual_value || '—') + '</td>' +
        '<td class="lens-cell-reason">' + esc(v.reason || '—') + '</td></tr>';
    }).join('') || emptyRow(5, 'No attribute validation for this product yet.');

    // ── 6. Title & alt text ──
    var ft = data.final_title, fa = data.final_alt_text;
    $('lensCurrentTitle').textContent = (ft && ft.current_title) || '—';
    $('lensSuggestedTitle').textContent = (ft && ft.suggested_title) || '—';
    $('lensTitleCharCount').textContent = (ft && ft.char_count) || 0;
    $('lensFinalTitleInput').value = (ft && (ft.final_title || ft.suggested_title)) || '';
    $('lensSuggestedAlt').textContent = (fa && fa.suggested_alt_text) || '—';
    $('lensFinalAltInput').value = (fa && (fa.final_alt_text || fa.suggested_alt_text)) || '';

    // ── 7. Final output ──
    qs('#lensFinalTable tbody').innerHTML = (data.final_ads_keywords || []).map(function (k) {
      var evid = k.existing_ads_evidence
        ? (k.existing_ads_evidence.performance ? 'Impressions ' + k.existing_ads_evidence.performance.impressions : 'Existing campaign keyword')
        : '—';
      return '<tr><td>' + esc(k.keyword) + '</td><td>' + esc(k.source) + '</td>' +
        '<td class="lens-num">' + num(k.phase1_frequency) + '</td>' +
        '<td class="lens-num">' + (k.planner_metrics && k.planner_metrics.avg_monthly_searches != null ? k.planner_metrics.avg_monthly_searches : '—') + '</td>' +
        '<td>' + esc(evid) + '</td>' +
        '<td>' + pill(humanise(k.final_status), k.final_status === 'INCLUDED' ? 'ok' : 'warn') + '</td></tr>';
    }).join('') || emptyRow(6, 'No final keywords for this product yet.');
  }

  function renderGeneration() {
    var g = state.generation;
    $('lensGenSource').textContent = g ? sourceLabel(g.generation_source) + (g.model_name ? ' (' + g.model_name + ')' : '') : '—';
    var failures = g && g.validation_failures && g.validation_failures.length ? ' — ' + g.validation_failures.join(', ') : '';
    $('lensGenValidation').textContent = g ? (validationLabel(g.validation_status) + failures) : '—';
  }
  function sourceLabel(s) {
    return { GEMMA_4_31B: 'Gemma 4', GEMMA_4_26B: 'Gemma 4', SCRIPT_FALLBACK: 'Deterministic script builder' }[s] || '—';
  }
  function validationLabel(s) {
    return {
      PASSED: 'Passed automatic validation',
      TITLE_SAFE_FALLBACK: 'Model output rejected twice — safe script title used instead',
      SCRIPT_FALLBACK: 'No generation model available — script title used',
    }[s] || (s || '—');
  }

  function saveFinalTitle() {
    var val = $('lensFinalTitleInput').value.trim();
    if (!val || !state.reportSku) return;
    api('lens-keyword-title-save', { method: 'POST', body: { run_id: state.runId, sku: state.reportSku, final_title: val } })
      .then(function () { toast('Title override saved.', 'ok'); })
      .catch(function (err) { toast(err.message || 'Could not save.', 'err'); });
  }
  function saveFinalAlt() {
    var val = $('lensFinalAltInput').value.trim();
    if (!val || !state.reportSku) return;
    api('lens-keyword-alt-save', { method: 'POST', body: { run_id: state.runId, sku: state.reportSku, final_alt_text: val } })
      .then(function () { toast('Alt text override saved.', 'ok'); })
      .catch(function (err) { toast(err.message || 'Could not save.', 'err'); });
  }
  function copyFinalKeywords() {
    var kws = ((state.report && state.report.final_ads_keywords) || [])
      .filter(function (k) { return k.final_status === 'INCLUDED'; })
      .map(function (k) { return k.keyword; });
    var text = kws.join(', ');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { toast('Copied ' + kws.length + ' keywords.', 'ok'); })
        .catch(function () { toast('Could not copy — select and copy manually.', 'err'); });
    } else {
      toast('Copy is not supported in this browser — select and copy manually.', 'err');
    }
  }

  // ── EVIDENCE DRAWER ──────────────────────────────────────────────────────
  function openDrawer(row) {
    state.lastFocus = document.activeElement;
    var fields = [
      ['Image Src', row.image_src], ['Image Alt', row.image_alt], ['URL', row.url],
      ['H3 Heading', row.h3_heading], ['Cite', row.cite],
      ['Emphasized Text', row.emphasized_text], ['Aria Label', row.aria_label],
      ['Rank', row.rank], ['Source', row.source_name], ['Provider', row.provider],
      ['Observed At', dateTime(row.observed_at)],
    ];
    var reasons = Array.isArray(row.decision_reasons) ? row.decision_reasons : [];
    $('lensDrawerBody').innerHTML =
      '<h5>Automatic decision</h5>' +
      '<dl><dt>Decision</dt><dd>' + esc(decisionLabel(row.auto_decision)) + '</dd>' +
      '<dt>Relevance score</dt><dd>' + num(row.auto_score) + (row.auto_score == null ? '' : ' / 100') + '</dd></dl>' +
      (reasons.length ? '<h5>Why</h5><ul>' + reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '') +
      '<h5>Captured evidence</h5><dl>' + fields.map(function (f) {
        var v = (f[1] === null || f[1] === undefined || f[1] === '')
          ? '<em>Not provided by current search provider</em>'
          : esc(f[1]);
        return '<dt>' + esc(f[0]) + '</dt><dd>' + v + '</dd>';
      }).join('') + '</dl>';
    $('lensDrawerScrim').hidden = false;
    $('lensDrawer').hidden = false;
    $('lensDrawerClose').focus();
  }
  function closeDrawer() {
    $('lensDrawerScrim').hidden = true;
    $('lensDrawer').hidden = true;
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  // ── 8. HISTORY ───────────────────────────────────────────────────────────
  function loadHistory() {
    var box = $('lensHistoryState');
    box.hidden = true;
    // Both of these are pure database reads. Opening a past run below reads
    // its stored rows — it never re-issues a provider call.
    var weekly = api('lens-keyword-weekly-history', { query: 'limit=20' }).then(function (data) {
      var rows = data.weekly_runs || [];
      qs('#lensWeeklyTable tbody').innerHTML = rows.map(function (w) {
        return '<tr><td>' + esc(w.iso_week) + '</td>' +
          '<td class="lens-cell-url">' + esc(w.run_id || '—') + '</td>' +
          '<td>' + dateTime(w.started_at) + '</td><td>' + dateTime(w.completed_at) + '</td>' +
          '<td class="lens-num">' + num(w.products_selected) + '</td>' +
          '<td class="lens-num">' + num(w.fresh_searches_used) + '</td>' +
          '<td class="lens-num">' + num(w.cached_searches_used) + '</td>' +
          '<td class="lens-num">' + num(w.gemma_generations) + '</td>' +
          '<td class="lens-num">' + num(w.script_fallback_generations) + '</td>' +
          '<td class="lens-cell-reason">' + esc(w.status_detail || w.error_message || '—') + '</td>' +
          '<td>' + pill(humanise(w.status), w.status === 'COMPLETED' ? 'ok' : w.status === 'FAILED' ? 'bad' : 'warn') + '</td></tr>';
      }).join('') || emptyRow(11, 'No weekly run has happened yet.');
    });

    var all = api('lens-keyword-run-history', { query: 'limit=25' }).then(function (data) {
      var runs = data.runs || [];
      qs('#lensRunTable tbody').innerHTML = runs.map(function (r) {
        return '<tr><td>' + dateTime(r.created_at) + '</td><td>' + esc(r.created_by || '—') + '</td>' +
          '<td>' + esc(r.batch_type || 'MANUAL') + '</td>' +
          '<td class="lens-num">' + num(r.products_total) + '</td>' +
          '<td class="lens-num">' + num(r.competitor_result_count) + '</td>' +
          '<td>' + pill(humanise(r.status), r.status === 'COMPLETED' ? 'ok' : r.status === 'FAILED' ? 'bad' : 'warn') + '</td>' +
          '<td><button type="button" class="lens-btn lens-btn-ghost lens-btn-sm" data-run="' + esc(r.run_id) + '">Open</button></td></tr>';
      }).join('') || emptyRow(7, 'No runs yet.');
      Array.prototype.forEach.call(qs('#lensRunTable tbody').querySelectorAll('[data-run]'), function (btn) {
        btn.addEventListener('click', function () { openStoredRun(btn.getAttribute('data-run')); });
      });
    });

    return Promise.all([weekly, all]).catch(function (err) {
      box.hidden = false;
      box.innerHTML = '<h3>Could not load history</h3><p>' + esc(err.message) + '</p>';
    });
  }

  function openStoredRun(runId) {
    api('lens-keyword-run-status', { query: 'run_id=' + encodeURIComponent(runId) }).then(function (s) {
      state.runId = s.run.run_id;
      state.run = s.run;
      state.runProducts = s.products || [];
      state.activeSku = null;
      state.reportSku = null;
      showView('competitors');
      renderRail('lensCompetitorRail', 'activeSku', loadCompetitors);
      loadCompetitors();
    }).catch(function (err) { toast(err.message || 'Could not open that run.', 'err'); });
  }

  // ── RESUME ON REFRESH ────────────────────────────────────────────────────
  function tryResume() {
    var pending;
    try { pending = localStorage.getItem(STORAGE_KEY); } catch (e) { pending = null; }
    if (!pending) return;
    api('lens-keyword-run-status', { query: 'run_id=' + encodeURIComponent(pending) }).then(function (s) {
      if (!s.run) { forget(); return; }
      state.runId = s.run.run_id;
      state.run = s.run;
      state.runProducts = s.products || [];
      if (s.done && s.run.analysis_status) { forget(); return; }
      driveRun();
    }).catch(forget);
    function forget() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* convenience only */ } }
  }

  // ── MOUNT ────────────────────────────────────────────────────────────────
  function mount(rootEl) {
    if (state.mounted) return;
    state.mounted = true;
    state.root = rootEl;

    fetch(BASE + 'index.html', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        rootEl.innerHTML = html;
        wireTabs();
        wireProductFilters();
        wireCompetitorFilters();
        $('lensRunBtn').addEventListener('click', runAutomation);
        $('lensPlanRefresh').addEventListener('click', function () { loadPlan(); loadAllProducts(); loadSchedule(); });
        $('lensSaveTitleBtn').addEventListener('click', saveFinalTitle);
        $('lensSaveAltBtn').addEventListener('click', saveFinalAlt);
        $('lensCopyFinalBtn').addEventListener('click', copyFinalKeywords);
        $('lensDrawerClose').addEventListener('click', closeDrawer);
        $('lensDrawerScrim').addEventListener('click', closeDrawer);
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && !$('lensDrawer').hidden) closeDrawer();
        });

        loadSchedule();
        loadAllProducts();
        loadPlan();
        tryResume();
      })
      .catch(function () {
        rootEl.innerHTML = '<p>Automation Keyword Finder could not load. Please refresh the page or contact the technical team.</p>';
      });
  }

  function unmount() {
    state.cancelDrive = true;
    state.mounted = false;
    closeDrawer();
    if (state.root) state.root.innerHTML = '';
  }

  window.SajeepanLensKeywords = { mount: mount, unmount: unmount };
})();
