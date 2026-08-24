/* pages/thivajini/feed-optimization/feed.js
 *
 * Shared UI behaviour for the Feed Optimization workspace.
 *
 * This file contains PRESENTATION ONLY. Every business decision — which
 * products are candidates, whether a Feed Gate is Eligible, whether a product
 * may be generated, what a verdict is — is made server-side in
 * api/members-api.js + lib/feed/*. The browser renders what the server says.
 *
 * No environment variable or secret is ever referenced here.
 */
(function (global) {
  'use strict';

  var FO = {};

  // ── auth gate, matching the other staff pages ────────────────────────
  FO.guard = function () {
    fetch('/api/auth?action=session', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status !== 200) { location.replace('../../login.html'); return null; }
        return r.json();
      })
      .then(function (d) {
        if (!d) return;
        if (d.success && d.user && (d.user.staff_key === 'thivajini' || d.user.role === 'admin')) {
          document.documentElement.classList.add('dm-ready');
          return;
        }
        location.replace('../../login.html');
      })
      .catch(function () { location.replace('../../login.html'); });
  };

  // ── transport ────────────────────────────────────────────────────────
  var BASE = '/api/members-api?member=thivajini&type=';

  FO.get = function (type, extra) {
    return fetch(BASE + type + (extra || ''), { credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (j) { j.__http = r.status; return j; }); });
  };
  FO.post = function (type, payload) {
    return fetch(BASE + type, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (r) { return r.json().then(function (j) { j.__http = r.status; return j; }); });
  };

  /* One place that turns any failure into something a staff member can act on.
     The API already sends staff wording for setup problems; this adds the two
     cases the API cannot see — an expired session and a dead connection. */
  FO.fail = function (d) {
    if (d && d.__http === 401) return 'Your session has expired. Please sign in again.';
    if (d && d.error) return d.error;
    return 'Something went wrong. Please try again, or contact the technical team if it keeps happening.';
  };
  FO.netFail = function (e) {
    return 'Could not reach the server' + (e && e.message ? ' (' + e.message + ')' : '') +
      '. Check your connection and try again.';
  };

  // ── formatting ───────────────────────────────────────────────────────
  FO.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  FO.num = function (n, d) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-GB', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };
  FO.pct = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return (Number(n) * 100).toFixed(2) + '%';
  };
  FO.day = function (s) { return s ? String(s).slice(0, 10) : '—'; };
  FO.when = function (s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d.getTime())) return String(s).slice(0, 16).replace('T', ' ');
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  FO.badge = function (kind, text, title) {
    return '<span class="badge ' + FO.esc(kind || 'grey') + '"' +
      (title ? ' title="' + FO.esc(title) + '"' : '') + '>' + FO.esc(text) + '</span>';
  };
  FO.loading = function (t) { return '<div class="fo-load"><span class="spin"></span>' + FO.esc(t) + '</div>'; };
  FO.empty = function (title, hint) {
    return '<div class="fo-empty"><b>' + FO.esc(title) + '</b>' + FO.esc(hint || '') + '</div>';
  };
  FO.skelRows = function (cols, rows) {
    var out = '';
    for (var i = 0; i < (rows || 4); i++) {
      out += '<tr>';
      for (var j = 0; j < cols; j++) out += '<td><div class="skel" style="width:' + (45 + ((i * 7 + j * 13) % 45)) + '%"></div></td>';
      out += '</tr>';
    }
    return out;
  };

  /* ── FEED GATE ─────────────────────────────────────────────────────────
     The server sends the decided state. The browser only chooses wording and
     colour, and NEVER shows the internal token. There is deliberately no
     branch that can turn CHECK into Eligible here.                          */
  FO.GATE_LABEL = {
    ELIGIBLE: 'Eligible',
    CHECK: 'Check Required',
    NOT_ELIGIBLE: 'Not Eligible'
  };
  FO.GATE_TONE = { ELIGIBLE: 'green', CHECK: 'amber', NOT_ELIGIBLE: 'red' };
  FO.gateBadge = function (g) {
    var st = (g && g.status) || 'CHECK';
    var label = FO.GATE_LABEL[st] || FO.GATE_LABEL.CHECK;
    var tone = FO.GATE_TONE[st] || 'amber';
    var why = (g && g.reasons && g.reasons.length) ? g.reasons.join(' · ')
      : 'Merchant eligibility status is not available from the current Ledsone DB. Review before production use.';
    return FO.badge(tone, label, why);
  };

  /* Data quality: three levels, always with a sentence. */
  FO.qualityBadge = function (q) {
    if (!q) return FO.badge('grey', 'Not assessed');
    var tone = q.level === 'COMPLETE' ? 'green' : q.level === 'MISSING_CRITICAL' ? 'red' : 'amber';
    var label = q.level === 'COMPLETE' ? 'Ready' : q.level === 'MISSING_CRITICAL' ? 'Blocked' : 'Review';
    return FO.badge(tone, label, q.summary || '');
  };

  FO.RESULT_TONE = {
    'Generated': 'green',
    'Skipped — Feed Gate': 'amber',
    'Skipped — insufficient evidence': 'amber',
    'Generation failed': 'red',
    'Validation failed': 'red'
  };
  FO.resultBadge = function (code, note) {
    if (!code) return FO.badge('grey', 'Waiting');
    return FO.badge(FO.RESULT_TONE[code] || 'grey', code, note || '');
  };

  // ── messages ─────────────────────────────────────────────────────────
  FO.msg = function (id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!text) { el.className = 'msg'; el.innerHTML = ''; return; }
    el.className = 'msg on ' + (kind || 'warn');
    el.innerHTML = text;
  };

  /* ── busy guard ────────────────────────────────────────────────────────
     Drops the second click while the first request is still in flight, so a
     double click, an impatient re-click or a stray Enter can never start two
     runs. Pairs with the server-side idempotency key.                       */
  var busy = {};
  FO.isBusy = function (id) { return !!busy[id]; };
  FO.busy = function (id, on, label) {
    busy[id] = !!on;
    var b = document.getElementById(id);
    if (!b) return;
    if (on) {
      if (b.dataset.label === undefined) b.dataset.label = b.innerHTML;
      b.disabled = true;
      b.innerHTML = FO.esc(label || 'Working…');
    } else {
      b.disabled = false;
      if (b.dataset.label !== undefined) b.innerHTML = b.dataset.label;
    }
  };

  // ── modal / drawer with focus management ─────────────────────────────
  var lastFocus = null;
  FO.openLayer = function (id) {
    lastFocus = document.activeElement;
    var back = document.getElementById('fo-backdrop');
    if (back) back.style.display = 'block';
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    var f = el.querySelector('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    if (f) f.focus(); else el.focus();
  };
  FO.closeLayers = function () {
    var back = document.getElementById('fo-backdrop');
    if (back) back.style.display = 'none';
    Array.prototype.forEach.call(document.querySelectorAll('.fo-modal,.fo-drawer'), function (m) {
      m.style.display = 'none';
    });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  };

  FO.wireLayers = function () {
    var back = document.getElementById('fo-backdrop');
    if (back) back.addEventListener('click', FO.closeLayers);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = document.querySelector('.fo-modal[style*="block"],.fo-drawer[style*="block"]');
      if (open) { e.preventDefault(); FO.closeLayers(); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-close-layer]'), function (b) {
      b.addEventListener('click', FO.closeLayers);
    });
  };

  // ── misc ─────────────────────────────────────────────────────────────
  FO.qs = function (k) {
    return new URLSearchParams(location.search).get(k);
  };
  /* A per-attempt key so a retried or double-fired request is recognised by
     the server as the SAME run rather than a new one. */
  FO.newKey = function () {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'k-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  };
  FO.elapsed = function (fromIso) {
    if (!fromIso) return '—';
    var ms = Date.now() - Date.parse(fromIso);
    if (isNaN(ms) || ms < 0) return '—';
    var s = Math.floor(ms / 1000);
    return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  };

  global.FO = FO;
})(window);
