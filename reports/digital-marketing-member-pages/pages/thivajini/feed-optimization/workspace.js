/* pages/thivajini/feed-optimization/workspace.js
 *
 * The main staff workspace: setup -> running -> report.
 *
 * Exactly ONE of the three views is visible at a time. Nothing is ever
 * appended below an existing view.
 *
 * The cycle itself lives in Postgres. This file starts it, then polls
 * `req5-cycle-advance` one product at a time. That keeps every request short,
 * keeps provider calls sequential, and means a refresh mid-run simply picks up
 * the durable state instead of starting again.
 */
(function () {
  'use strict';

  var S = {
    cycleId: null,
    startedAt: null,
    report: null,
    columns: null,
    running: false,
    runKey: null
  };

  var STEP_ORDER = [
    { key: 'PREPARING', label: 'Preparing products' },
    { key: 'GATES', label: 'Checking feed gates' },
    { key: 'EVIDENCE', label: 'Loading search evidence' },
    { key: 'GENERATING', label: 'Generating A/B variants' },
    { key: 'VALIDATING', label: 'Validating' },
    { key: 'REPORT', label: 'Building report' }
  ];

  // ── view switching: one view, never a stack ──────────────────────────
  function view(name) {
    ['setup', 'run', 'report'].forEach(function (v) {
      var el = document.getElementById('fo-view-' + v);
      if (el) el.hidden = (v !== name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ═══════════ 1. SETUP ═══════════
  function loadOverview() {
    FO.get('req5-candidates', '&limit=200').then(function (d) {
      var stats = document.getElementById('fo-stats');
      if (!d.ok) {
        FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err');
        stats.innerHTML = statCard('—', 'Products available', 'Could not load');
        return;
      }
      var products = d.products || [];
      var ready = products.filter(function (p) { return p.data_quality && p.data_quality.can_generate; }).length;
      var fresh = d.terms_freshness || {};
      var readiness = fresh.status === 'STALE' ? 'Review' : 'Ready';

      // Populate the priority filter from what actually came back.
      var sel = document.getElementById('fo-set-priority');
      var tiers = [];
      products.forEach(function (p) { if (tiers.indexOf(p.priority_tier) < 0) tiers.push(p.priority_tier); });
      tiers.sort().forEach(function (t) {
        var o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
      });

      stats.innerHTML =
        statCard(products.length, 'Products available',
          ready + ' with enough evidence to generate') +
        statCard(readiness, 'Data readiness',
          fresh.latest ? 'Search data to ' + FO.esc(fresh.latest) : 'No search data found') +
        '<div class="fo-stat" id="fo-stat-cycle"><div class="v">—</div><div class="k">Active cycle</div><div class="n">No cycle running</div></div>' +
        '<div class="fo-stat" id="fo-stat-mon"><div class="v"><span class="skel" style="display:block;width:40px;height:22px"></span></div><div class="k">Active monitoring tests</div></div>';

      loadMonitoringCount();
      loadLastCycle();
    }).catch(function (e) { FO.msg('fo-msg', FO.esc(FO.netFail(e)), 'err'); });
  }

  function statCard(v, k, n) {
    return '<div class="fo-stat"><div class="v">' + FO.esc(v) + '</div><div class="k">' + FO.esc(k) + '</div>' +
      (n ? '<div class="n">' + FO.esc(n) + '</div>' : '') + '</div>';
  }

  function loadMonitoringCount() {
    FO.get('req5-monitoring').then(function (d) {
      var el = document.getElementById('fo-stat-mon');
      if (!el) return;
      var plans = (d.ok && d.plans) || [];
      var live = plans.filter(function (p) { return p.actual_go_live_date; }).length;
      el.innerHTML = '<div class="v">' + live + '</div><div class="k">Active monitoring tests</div>' +
        '<div class="n">' + (plans.length - live) + ' awaiting go-live confirmation</div>';
    }).catch(function () {});
  }

  /* If a cycle was left unfinished (closed tab, dropped connection), offer to
     resume it rather than silently starting a second one. */
  function loadLastCycle() {
    FO.get('req5-cycle-history', '&limit=1').then(function (d) {
      if (!d.ok || !d.cycles || !d.cycles.length) return;
      var c = d.cycles[0];
      var terminal = ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED'];
      var el = document.getElementById('fo-stat-cycle');
      if (terminal.indexOf(c.status) < 0) {
        if (el) el.innerHTML = '<div class="v">#' + c.cycle_no + '</div><div class="k">Active cycle</div>' +
          '<div class="n">' + c.counts.done + ' of ' + c.counts.total + ' products done</div>';
        S.cycleId = c.cycle_id;
        S.startedAt = c.started_at;
        document.getElementById('fo-resume').style.display = '';
      } else if (el) {
        el.innerHTML = '<div class="v">#' + c.cycle_no + '</div><div class="k">Last cycle</div>' +
          '<div class="n">' + FO.esc(c.status.replace(/_/g, ' ').toLowerCase()) + '</div>';
      }
    }).catch(function () {});
  }

  // ═══════════ 2. RUN ═══════════
  function startCycle() {
    if (FO.isBusy('fo-run') || S.running) return;
    FO.msg('fo-msg', '');
    // One key per attempt. A double click, a refresh mid-request or a platform
    // retry all carry the same key, so the server returns the SAME cycle.
    if (!S.runKey) S.runKey = FO.newKey();
    FO.busy('fo-run', true, 'Starting…');
    FO.busy('fo-settings-run', true, 'Starting…');

    FO.post('req5-cycle-create', {
      idempotency_key: S.runKey,
      product_count: Number(document.getElementById('fo-set-count').value) || 10,
      priority_tier: document.getElementById('fo-set-priority').value || null,
      allow_draft_for_check: document.getElementById('fo-set-draft').checked
    }).then(function (d) {
      FO.busy('fo-run', false);
      FO.busy('fo-settings-run', false);
      FO.closeLayers();
      if (!d.ok) { FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err'); S.runKey = null; return; }
      S.cycleId = d.cycle.cycle_id;
      S.startedAt = d.cycle.started_at || new Date().toISOString();
      view('run');
      renderRun(d.cycle, []);
      pump();
    }).catch(function (e) {
      FO.busy('fo-run', false); FO.busy('fo-settings-run', false);
      S.runKey = null;
      FO.msg('fo-msg', FO.esc(FO.netFail(e)), 'err');
    });
  }

  /* Drive the cycle forward one product per request. Sequential by
     construction, so ten products can never become ten concurrent AI calls. */
  function pump() {
    if (S.running) return;
    S.running = true;
    tick();
  }
  function tick() {
    FO.post('req5-cycle-advance', { cycle_id: S.cycleId }).then(function (d) {
      if (!d.ok) {
        S.running = false;
        FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err');
        return;
      }
      renderRun(d.cycle, d.products || []);
      if (d.done) {
        S.running = false;
        S.runKey = null;
        loadReport();
        return;
      }
      setTimeout(tick, d.waiting_on_other_worker ? 1500 : 250);
    }).catch(function (e) {
      S.running = false;
      FO.msg('fo-msg', FO.esc(FO.netFail(e)) + ' The cycle is saved &mdash; press Resume to continue.', 'err');
      view('setup');
      document.getElementById('fo-resume').style.display = '';
    });
  }

  function renderRun(cycle, products) {
    var c = cycle.counts || { total: 0, done: 0 };
    document.getElementById('fo-run-title').textContent = 'Cycle #' + cycle.cycle_no;
    document.getElementById('fo-run-count').textContent = c.done + ' of ' + c.total + ' products processed';
    document.getElementById('fo-run-elapsed').textContent = FO.elapsed(S.startedAt) + ' elapsed';
    document.getElementById('fo-run-status').textContent = statusText(cycle);
    var pctDone = c.total ? Math.round((c.done / c.total) * 100) : 0;
    document.getElementById('fo-run-bar').style.width = pctDone + '%';

    var reached = c.done > 0 ? 3 : 0;
    document.getElementById('fo-run-steps').innerHTML = STEP_ORDER.map(function (s, i) {
      var cls = i < reached ? 'done' : i === reached ? 'active' : '';
      var mark = i < reached ? '✓' : i === reached ? '●' : '○';
      return '<li class="' + cls + '"><span class="mark">' + mark + '</span>' + FO.esc(s.label) + '</li>';
    }).join('');

    document.getElementById('fo-run-products').innerHTML = products.map(function (p) {
      return '<li><span class="t">' + FO.esc(p.title || p.item_id) + '</span>' + productStateBadge(p) + '</li>';
    }).join('') || '<li><span class="t">Preparing…</span></li>';
  }

  function statusText(cycle) {
    var map = {
      CREATED: 'Starting', PREPARING: 'Preparing products', GENERATING: 'Generating variants',
      COMPLETED: 'Complete', COMPLETED_WITH_WARNINGS: 'Complete with warnings', FAILED: 'Failed'
    };
    var t = map[cycle.status] || cycle.status;
    return cycle.status_detail ? t + ' — ' + cycle.status_detail : t;
  }

  function productStateBadge(p) {
    if (p.state === 'GENERATED') return FO.badge('green', '✓ Generated');
    if (p.state === 'CHECK_REQUIRED') return FO.badge('amber', '⚠ Check Required', p.result_note || '');
    if (p.state === 'SKIPPED') return FO.badge('amber', '⚠ Skipped', p.result_note || '');
    if (p.state === 'FAILED' || p.state === 'VALIDATION_FAILED') return FO.badge('red', '✕ ' + (p.result_code || 'Failed'), p.result_note || '');
    if (p.state === 'RUNNING') return FO.badge('blue', '● Generating');
    return FO.badge('grey', '○ Waiting');
  }

  // ═══════════ 3. REPORT ═══════════
  function loadReport() {
    view('report');
    var tb = document.querySelector('#fo-rep-tbl tbody');
    tb.innerHTML = FO.skelRows(10, 4);
    FO.get('req5-cycle-report', '&cycle=' + encodeURIComponent(S.cycleId)).then(function (d) {
      if (!d.ok) { tb.innerHTML = '<tr><td colspan="10">' + FO.empty('Report could not be loaded', FO.fail(d)) + '</td></tr>'; return; }
      S.report = d;
      renderReport(d);
    }).catch(function (e) {
      tb.innerHTML = '<tr><td colspan="10">' + FO.empty('Report could not be loaded', FO.netFail(e)) + '</td></tr>';
    });
  }

  function renderReport(d) {
    var c = d.cycle, k = c.counts;
    document.getElementById('fo-rep-title').textContent =
      c.status === 'FAILED' ? 'Optimization Cycle Failed'
        : c.status === 'COMPLETED_WITH_WARNINGS' ? 'Optimization Cycle Complete — with warnings'
          : 'Optimization Cycle Complete';
    document.getElementById('fo-rep-when').textContent =
      'Cycle #' + c.cycle_no + ' · generated ' + FO.when(c.finished_at || c.created_at) + ' by ' + c.created_by;

    document.getElementById('fo-rep-stats').innerHTML =
      statCard(k.total, 'Products considered') +
      statCard(k.generated, 'Generated successfully') +
      statCard(k.check_required, 'Check required') +
      statCard(k.failed + k.skipped, 'Failed or skipped') +
      statCard(c.llm_calls, 'Total AI calls', c.gemini_calls + ' used Gemini fallback');

    var tb = document.querySelector('#fo-rep-tbl tbody');
    if (!d.rows.length) {
      tb.innerHTML = '<tr><td colspan="10">' + FO.empty('This cycle produced no rows.', '') + '</td></tr>';
      return;
    }
    tb.innerHTML = d.rows.map(function (r, i) {
      var a = (r.variants || []).find(function (v) { return v.variant_label === 'A'; });
      var b = (r.variants || []).find(function (v) { return v.variant_label === 'B'; });
      return '<tr>' +
        '<td><div style="display:flex;gap:9px;align-items:center;">' +
          (r.image_link
            ? '<img src="' + FO.esc(r.image_link) + '" alt="" loading="lazy" style="width:34px;height:34px;object-fit:contain;border:1px solid var(--line);border-radius:6px;background:#fff;flex:none;">'
            : '<span style="width:34px;height:34px;border-radius:6px;background:#f4f6f9;flex:none;"></span>') +
          '<span class="trunc" title="' + FO.esc(r.title || '') + '">' +
          FO.esc(r.product_type || r.title || 'Product') + '</span></div></td>' +
        '<td class="col-opt"><span class="mono">' + FO.esc(r.item_id) + '</span>' +
          (r.sku ? '<br><span class="mono">' + FO.esc(r.sku) + '</span>' : '') + '</td>' +
        '<td>' + FO.gateBadge(r.feed_gate) + '</td>' +
        '<td class="col-opt"><span class="trunc" title="' + FO.esc(r.title || '') + '">' +
          FO.esc(r.title || 'No title on file') + '</span></td>' +
        '<td>' + variantCell(a) + '</td>' +
        '<td>' + variantCell(b) + '</td>' +
        '<td class="col-opt">' + (r.terms_count ? r.terms_count + ' terms' : '—') + '</td>' +
        '<td>' + FO.qualityBadge(r.data_quality) + '</td>' +
        '<td>' + FO.resultBadge(r.result_code, r.result_note) + '</td>' +
        '<td>' + choiceCell(r, i) + '</td>' +
        '</tr>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (btn) {
      btn.addEventListener('click', function () { openCompare(d.rows[Number(btn.getAttribute('data-view'))]); });
    });
  }

  function variantCell(v) {
    if (!v) return '<span style="color:var(--muted);">—</span>';
    var ok = v.validation_status === 'PASS';
    return '<span class="trunc" title="' + FO.esc(v.title_fr) + '">' + FO.esc(v.title_fr) + '</span>' +
      '<div style="margin-top:3px;">' + FO.badge(ok ? 'green' : 'red', ok ? 'Passed' : 'Failed') +
      ' <span class="mono">' + v.title_char_count + ' chars</span></div>';
  }

  function choiceCell(r, i) {
    if (!(r.variants || []).length) return '<span style="color:var(--muted);">—</span>';
    var sel = r.selected_variant;
    return '<button class="btn btn-sm" data-view="' + i + '">' +
      (sel ? 'Variant ' + FO.esc(sel) : 'View') + '</button>' +
      (r.excluded_from_export ? '<div style="margin-top:3px;">' + FO.badge('grey', 'Excluded') + '</div>' : '');
  }

  // ── variant comparison drawer ────────────────────────────────────────
  function openCompare(r) {
    document.getElementById('fo-compare-h').textContent = r.title || r.item_id;
    document.getElementById('fo-compare-sub').textContent = r.item_id + (r.sku ? ' · ' + r.sku : '');
    var body = document.getElementById('fo-compare-body');

    if (!(r.variants || []).length) {
      body.innerHTML = FO.empty('No variants were generated for this product.', r.result_note || '');
      FO.openLayer('fo-compare');
      return;
    }

    body.innerHTML =
      '<h4>Current copy</h4>' +
      '<div class="copy">' + FO.esc(r.title || 'No current title on file') + '</div>' +
      '<div class="copy" style="max-height:130px;overflow:auto;">' + FO.esc(r.current_description || 'No current description on file') + '</div>' +
      r.variants.map(function (v) {
        var ok = v.validation_status === 'PASS';
        var terms = [];
        try { terms = JSON.parse(v.converting_terms_used || '[]'); } catch (e) { terms = v.converting_terms_used || []; }
        var chosen = r.selected_variant === v.variant_label;
        return '<h4>Variant ' + FO.esc(v.variant_label) + ' ' +
            FO.badge(ok ? 'green' : 'red', ok ? 'Passed validation' : 'Failed validation') +
            (chosen ? ' ' + FO.badge('blue', 'Selected') : '') + '</h4>' +
          '<div style="font-size:11.5px;color:var(--muted);">Title · ' + v.title_char_count + ' of 150 characters</div>' +
          '<div class="copy">' + FO.esc(v.title_fr) + '</div>' +
          '<div style="font-size:11.5px;color:var(--muted);">Description</div>' +
          '<div class="copy">' + FO.esc(v.description_fr) + '</div>' +
          '<div style="font-size:12.5px;line-height:1.7;">' +
            '<div><b>Converting terms used:</b> ' + FO.esc((Array.isArray(terms) ? terms : []).join(', ') || '—') + '</div>' +
            '<div><b>Suggested Google Product Category:</b> ' + FO.esc(v.suggested_gpc || '—') + '</div>' +
          '</div>' +
          (ok ? '<button class="btn btn-sm ' + (chosen ? '' : 'btn-primary') + '" data-pick="' + FO.esc(v.variant_label) +
                '" data-item="' + FO.esc(r.item_id) + '" style="margin-top:9px;">' +
                (chosen ? 'Selected' : 'Select Variant ' + FO.esc(v.variant_label)) + '</button>'
             : '<div style="font-size:12.5px;color:var(--bad);margin-top:8px;">This variant did not pass validation and cannot be selected.</div>');
      }).join('') +
      '<h4>Export</h4>' +
      '<label class="fo-choice"><input type="checkbox" id="fo-cmp-exclude" data-item="' + FO.esc(r.item_id) + '"' +
        (r.excluded_from_export ? ' checked' : '') + '>' +
        '<span>Exclude this product from the download</span></label>' +
      '<div style="margin-top:14px;"><button class="btn btn-sm" data-pick="" data-item="' + FO.esc(r.item_id) + '">Leave unselected</button></div>';

    Array.prototype.forEach.call(body.querySelectorAll('[data-pick]'), function (b) {
      b.addEventListener('click', function () { pick(b.getAttribute('data-item'), b.getAttribute('data-pick')); });
    });
    var ex = document.getElementById('fo-cmp-exclude');
    if (ex) ex.addEventListener('change', function () { pick(ex.getAttribute('data-item'), undefined, ex.checked); });

    FO.openLayer('fo-compare');
  }

  function pick(itemId, label, excluded) {
    var payload = { cycle_id: S.cycleId, item_id: itemId };
    if (label !== undefined) payload.variant_label = label;
    if (excluded !== undefined) payload.excluded = excluded;
    FO.post('req5-cycle-select', payload).then(function (d) {
      if (!d.ok) { FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err'); return; }
      var row = S.report.rows.find(function (r) { return r.item_id === itemId; });
      if (row) { row.selected_variant = d.selected_variant; row.excluded_from_export = d.excluded_from_export; }
      renderReport(S.report);
      if (label !== undefined) FO.closeLayers();
    }).catch(function (e) { FO.msg('fo-msg', FO.esc(FO.netFail(e)), 'err'); });
  }

  // ═══════════ 4. DOWNLOAD ═══════════
  function openDownload() {
    if (!S.report) return;
    var eligible = S.report.rows.filter(function (r) { return r.selected_variant && !r.excluded_from_export; });
    document.getElementById('fo-dl-sub').textContent = eligible.length
      ? eligible.length + ' product' + (eligible.length === 1 ? '' : 's') + ' with a selected variant will be exported.'
      : 'No product has a selected variant yet — choose Variant A or B in the report first.';

    document.getElementById('fo-dl-products').innerHTML = S.report.rows.map(function (r) {
      var can = !!r.selected_variant;
      return '<label class="fo-choice" style="padding:7px 10px;margin-bottom:5px;">' +
        '<input type="checkbox" class="fo-dl-row" value="' + FO.esc(r.item_id) + '"' +
          (can && !r.excluded_from_export ? ' checked' : '') + (can ? '' : ' disabled') + '>' +
        '<span style="font-size:12.5px;"><b>' + FO.esc(r.title || r.item_id) + '</b>' +
        (can ? ' — Variant ' + FO.esc(r.selected_variant) : ' — <span style="color:var(--muted);">no variant selected</span>') +
        '</span></label>';
    }).join('');

    if (S.columns) { renderColumns(S.columns.default_keys); FO.openLayer('fo-dl'); return; }
    FO.get('req5-export-columns').then(function (d) {
      if (!d.ok) { FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err'); return; }
      S.columns = d;
      renderColumns(d.default_keys);
      FO.openLayer('fo-dl');
    }).catch(function (e) { FO.msg('fo-msg', FO.esc(FO.netFail(e)), 'err'); });
  }

  function renderColumns(chosen) {
    var d = S.columns;
    document.getElementById('fo-col-groups').innerHTML = Object.keys(d.groups).map(function (g) {
      return '<div><div style="font-size:12px;font-weight:700;margin-bottom:6px;color:#42506a;">' + FO.esc(g) + '</div>' +
        d.groups[g].map(function (c) {
          return '<label><input type="checkbox" class="fo-col" value="' + FO.esc(c.key) + '"' +
            (chosen.indexOf(c.key) >= 0 ? ' checked' : '') + '>' + FO.esc(c.label) + '</label>';
        }).join('') + '</div>';
    }).join('');
  }

  function doDownload() {
    if (FO.isBusy('fo-dl-go')) return;
    var cols = Array.prototype.map.call(document.querySelectorAll('.fo-col:checked'), function (c) { return c.value; });
    var warn = document.getElementById('fo-col-warn');
    if (!cols.length) { warn.style.display = ''; return; }
    warn.style.display = 'none';

    var wanted = Array.prototype.map.call(document.querySelectorAll('.fo-dl-row:checked'), function (c) { return c.value; });
    var selections = S.report.rows
      .filter(function (r) { return r.selected_variant && wanted.indexOf(r.item_id) >= 0; })
      .map(function (r) {
        return { generation_id: r.generation_id, variant_label: r.selected_variant, item_id: r.item_id };
      });
    if (!selections.length) {
      FO.msg('fo-msg', 'Select at least one product that has a chosen variant.', 'warn');
      return;
    }

    FO.busy('fo-dl-go', true, 'Preparing file…');
    FO.post('req5-export', {
      batch_id: S.report.cycle.batch_id,
      cycle_id: S.cycleId,
      columns: cols,
      // Downloading is NOT a go-live. Monitoring is a separate, explicit action,
      // so no monitoring plan is created here.
      monitoring_start_mode: 'DEFERRED',
      selections: selections
    }).then(function (d) {
      FO.busy('fo-dl-go', false);
      if (!d.ok) { FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err'); return; }
      var blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = d.filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      FO.closeLayers();
      FO.msg('fo-msg',
        'Downloaded ' + d.row_count + ' row' + (d.row_count === 1 ? '' : 's') + '. ' +
        '<b>Nothing is live yet.</b> Upload the file to Merchant Center, then press <b>Start Monitoring</b>.', 'warn');
    }).catch(function (e) {
      FO.busy('fo-dl-go', false);
      FO.msg('fo-msg', FO.esc(FO.netFail(e)), 'err');
    });
  }

  // ═══════════ 5. START MONITORING (explicit, never automatic) ═══════════
  function confirmMonitoring() {
    if (FO.isBusy('fo-mon-go')) return;
    if (document.getElementById('fo-mon-not').checked) {
      FO.closeLayers();
      FO.msg('fo-msg', 'Monitoring was not started. Come back once the change is live.', 'warn');
      return;
    }
    var custom = document.getElementById('fo-mon-other').checked;
    var when = custom ? document.getElementById('fo-mon-date').value : new Date().toISOString().slice(0, 10);
    if (!when) { FO.msg('fo-msg', 'Choose the date the change went live.', 'warn'); return; }

    var selections = S.report.rows
      .filter(function (r) { return r.selected_variant && !r.excluded_from_export; })
      .map(function (r) { return { generation_id: r.generation_id, variant_label: r.selected_variant, item_id: r.item_id }; });
    if (!selections.length) {
      FO.msg('fo-msg', 'No product has a selected variant, so there is nothing to monitor.', 'warn');
      return;
    }

    FO.busy('fo-mon-go', true, 'Starting…');
    FO.post('req5-monitoring-start', {
      cycle_id: S.cycleId,
      batch_id: S.report.cycle.batch_id,
      actual_go_live_date: when,
      selections: selections
    }).then(function (d) {
      FO.busy('fo-mon-go', false);
      if (!d.ok) { FO.msg('fo-msg', FO.esc(FO.fail(d)), 'err'); return; }
      FO.closeLayers();
      FO.msg('fo-msg', 'Monitoring started for ' + d.started + ' product' + (d.started === 1 ? '' : 's') +
        ', live from ' + FO.esc(when) + '. <a href="monitoring.html">Open Monitoring</a>.', 'ok');
    }).catch(function (e) {
      FO.busy('fo-mon-go', false);
      FO.msg('fo-msg', FO.esc(FO.netFail(e)), 'err');
    });
  }

  // ═══════════ 6. DIAGNOSTICS ═══════════
  function openDiagnostics() {
    var body = document.getElementById('fo-diag-body');
    body.innerHTML = FO.loading('Loading diagnostics…');
    FO.openLayer('fo-diag');
    Promise.all([FO.get('req5-telemetry'), FO.get('req5-provider-status')]).then(function (r) {
      var d = r[0], ps = r[1];
      if (!d.ok) { body.innerHTML = FO.empty('Diagnostics could not be loaded', FO.fail(d)); return; }
      var mig = d.migration || {}, tgt = mig.target || {};
      body.innerHTML =
        '<h4>Database</h4>' +
        '<div style="font-size:12.5px;line-height:1.9;">' +
          '<div>Schema: ' + (mig.applied ? FO.badge('green', 'applied') : FO.badge('red', 'not applied')) + '</div>' +
          '<div>Variable: <code>' + FO.esc(tgt.variable || '—') + '</code></div>' +
          '<div>Database reached: ' + FO.esc(tgt.current_database || '—') + '</div>' +
          '<div>Connected as: ' + FO.esc(tgt.current_user || '—') + '</div>' +
          '<div>Req5 tables: ' + ((mig.present || []).length) + ' of ' + ((mig.expected || []).length) + '</div>' +
        '</div>' +
        '<h4>Providers</h4>' +
        (ps && ps.ok ? ['local', 'gemini_key_1', 'gemini_key_2'].map(function (k) {
          var p = ps[k === 'local' ? 'local' : k];
          if (!p) return '';
          var ok = p.configured && p.reachable;
          return '<div style="font-size:12.5px;line-height:1.9;">' + FO.esc(k) + ': ' +
            (ok ? FO.badge('green', 'available') : FO.badge('amber', 'unavailable')) +
            ' <code>' + FO.esc(p.model || '—') + '</code>' +
            (p.input_context_limit ? ' · context ' + FO.num(p.input_context_limit) : '') +
            (p.error ? ' <span style="color:var(--muted);">' + FO.esc(p.error) + '</span>' : '') + '</div>';
        }).join('') : '<div style="font-size:12.5px;color:var(--muted);">Provider probe unavailable.</div>') +
        '<h4>Environment (presence only)</h4>' +
        '<div style="font-size:12.5px;line-height:1.9;">' +
        Object.keys(d.env_present || {}).map(function (k) {
          return '<div><code>' + FO.esc(k) + '</code> ' +
            (d.env_present[k] ? FO.badge('green', 'present') : FO.badge('amber', 'not set')) + '</div>';
        }).join('') +
        '</div>' +
        '<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Values are never read by the browser.</div>' +
        '<h4>Merchant API Push</h4>' +
        '<div style="font-size:12.5px;">' + FO.badge('grey', 'Future — not enabled') +
        '<div style="color:var(--muted);margin-top:5px;">The output path is a manual CSV download and upload. No Merchant write is performed.</div></div>' +
        '<h4>Usage notes</h4>' +
        '<div style="font-size:11.5px;color:var(--muted);line-height:1.7;">' + FO.esc(d.usage_note || '') +
        '<br><br>' + FO.esc(d.quota_note || '') + '</div>';
    }).catch(function (e) { body.innerHTML = FO.empty('Diagnostics could not be loaded', FO.netFail(e)); });
  }

  // ═══════════ wiring ═══════════
  function on(id, ev, fn) { var e = document.getElementById(id); if (e) e.addEventListener(ev, fn); }

  document.addEventListener('DOMContentLoaded', function () {
    FO.wireLayers();
    loadOverview();

    on('fo-run', 'click', startCycle);
    on('fo-settings-open', 'click', function () { FO.openLayer('fo-settings'); });
    on('fo-settings-run', 'click', startCycle);
    on('fo-resume-btn', 'click', function () { view('run'); pump(); });

    on('fo-rep-download', 'click', openDownload);
    on('fo-col-rec', 'click', function () { renderColumns(S.columns.default_keys); });
    on('fo-col-all', 'click', function () { renderColumns(S.columns.all_keys); });
    on('fo-col-none', 'click', function () { renderColumns([]); });
    on('fo-dl-go', 'click', doDownload);

    on('fo-start-monitoring', 'click', function () {
      document.getElementById('fo-mon-date').value = new Date().toISOString().slice(0, 10);
      FO.openLayer('fo-mon');
    });
    on('fo-mon-go', 'click', confirmMonitoring);
    ['fo-mon-today', 'fo-mon-other', 'fo-mon-not'].forEach(function (id) {
      on(id, 'change', function () {
        document.getElementById('fo-mon-datewrap').style.display =
          document.getElementById('fo-mon-other').checked ? '' : 'none';
      });
    });

    on('fo-rep-details', 'click', function () { location.href = 'cycle.html?cycle=' + encodeURIComponent(S.cycleId); });
    on('fo-rep-new', 'click', function () { S.cycleId = null; S.report = null; S.runKey = null; view('setup'); loadOverview(); });
    on('fo-diag-open', 'click', function (e) { e.preventDefault(); openDiagnostics(); });
  });
})();
