/* ============================================================
   Debug watchdog — self-contained, no dependencies.
   Remove file + remove one <script> line to disable completely.
   ============================================================ */
(function () {
  'use strict';

  if (window.__smyarDebugInstalled) return;
  window.__smyarDebugInstalled = true;

  // ---------- storage ----------
  var MAX = 200;
  var entries = [];
  var errorCount = 0;
  var panelOpen = false;
  var currentFilter = 'all';

  // ---------- original console ----------
  var origError = console.error ? console.error.bind(console) : function () {};
  var origWarn = console.warn ? console.warn.bind(console) : function () {};
  var origLog = console.log ? console.log.bind(console) : function () {};
  var origInfo = console.info ? console.info.bind(console) : function () {};

  // ---------- utils ----------
  function ts() {
    var d = new Date();
    function p(n, w) {
      n = String(n);
      while (n.length < (w || 2)) n = '0' + n;
      return n;
    }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
  }

  function fmt(v) {
    if (v == null) return String(v);
    if (v instanceof Error) return v.message + (v.stack ? '\n' + v.stack : '');
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
    if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
    if (typeof v === 'object') {
      try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
    }
    return String(v);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- add entry ----------
  function add(type, message, opts) {
    opts = opts || {};
    try {
      var entry = {
        type: type,
        message: String(message || ''),
        stack: opts.stack || null,
        source: opts.source || null,
        ts: ts(),
        t: Date.now()
      };
      entries.push(entry);
      if (entries.length > MAX) entries.shift();
      if (type === 'error') errorCount++;
      updateButton();
      if (panelOpen) renderList();
    } catch (e) {
      // never let the debugger crash the app
      origError.call(console, '[debug] add failed:', e);
    }
  }

  // ---------- error listeners (installed immediately) ----------

  // window errors + resource load errors
  window.addEventListener('error', function (evt) {
    try {
      var t = evt.target;
      if (t && t !== window && (t.tagName === 'SCRIPT' || t.tagName === 'LINK' || t.tagName === 'IMG' || t.tagName === 'VIDEO' || t.tagName === 'AUDIO' || t.tagName === 'SOURCE')) {
        var tag = t.tagName.toLowerCase();
        var url = t.src || t.href || '(unknown)';
        add('error', 'Failed to load <' + tag + '>: ' + url, { source: 'resource' });
        return;
      }
      var msg = evt.message || 'Unknown error';
      var stack = (evt.error && evt.error.stack) ? evt.error.stack : null;
      if (!stack && evt.filename) {
        stack = evt.filename + ':' + (evt.lineno || '?') + ':' + (evt.colno || '?');
      }
      add('error', msg, { stack: stack, source: evt.filename || 'window.error' });
    } catch (e) { /* swallow */ }
  }, true);

  // unhandled promise rejections
  window.addEventListener('unhandledrejection', function (evt) {
    try {
      var r = evt.reason;
      var msg = (r && r.message) ? r.message : (typeof r === 'string' ? r : 'Unhandled promise rejection');
      var stack = (r && r.stack) ? r.stack : null;
      add('error', msg, { stack: stack, source: 'promise' });
    } catch (e) { /* swallow */ }
  });

  // CSP violations
  document.addEventListener('securitypolicyviolation', function (evt) {
    try {
      add('error', 'CSP blocked: ' + (evt.blockedURI || '?') + ' (' + evt.violatedDirective + ')', { source: 'csp' });
    } catch (e) { /* swallow */ }
  });

  // ---------- console overrides (only warn/error/info) ----------
  console.error = function () {
    try {
      var args = Array.prototype.slice.call(arguments);
      var errObj = null;
      for (var i = 0; i < args.length; i++) {
        if (args[i] instanceof Error) { errObj = args[i]; break; }
      }
      add('error', args.map(fmt).join(' '), {
        stack: errObj ? errObj.stack : null,
        source: 'console.error'
      });
    } catch (e) { /* swallow */ }
    return origError.apply(null, arguments);
  };

  console.warn = function () {
    try {
      var args = Array.prototype.slice.call(arguments);
      add('warn', args.map(fmt).join(' '), { source: 'console.warn' });
    } catch (e) { /* swallow */ }
    return origWarn.apply(null, arguments);
  };

  console.info = function () {
    try {
      var args = Array.prototype.slice.call(arguments);
      add('info', args.map(fmt).join(' '), { source: 'console.info' });
    } catch (e) { /* swallow */ }
    return origInfo.apply(null, arguments);
  };

  // ---------- fetch failure logging ----------
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = '(unknown)';
      try {
        url = (typeof input === 'string') ? input : (input && input.url ? input.url : '(unknown)');
      } catch (e) { /* ignore */ }
      return origFetch.apply(this, arguments).catch(function (err) {
        try {
          if (err && err.name !== 'AbortError') {
            add('error', 'Fetch failed: ' + url + '\n' + (err.message || err), { source: 'fetch' });
          }
        } catch (e) { /* swallow */ }
        throw err;
      });
    };
  }

  // ---------- styles ----------
  var STYLE_ID = 'smyar-debug-style';
  function injectStyle() {
    try {
      if (document.getElementById(STYLE_ID)) return;
      if (!document.head) { setTimeout(injectStyle, 20); return; }
      var s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = [
        '#smyar-debug-btn{position:fixed;bottom:16px;left:16px;z-index:2147483647;width:44px;height:44px;border-radius:50%;background:#1e1e2e;color:#f3f4ff;border:1px solid rgba(255,255,255,.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;font-size:11px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.5);padding:0;transition:transform .15s}',
        '#smyar-debug-btn:hover{transform:scale(1.08)}',
        '#smyar-debug-btn.has-errors{background:#7f1d1d;border-color:#ef4444;animation:smyar-debug-pulse 2s infinite}',
        '#smyar-debug-btn.has-errors.acknowledged{animation:none;background:#450a0a}',
        '@keyframes smyar-debug-pulse{0%,100%{box-shadow:0 4px 16px rgba(239,68,68,.4)}50%{box-shadow:0 4px 24px rgba(239,68,68,.9)}}',
        '#smyar-debug-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;padding:0 4px;display:none;align-items:center;justify-content:center;border:2px solid #1e1e2e}',
        '#smyar-debug-btn.has-errors #smyar-debug-badge{display:flex}',
        '#smyar-debug-panel{position:fixed;bottom:70px;left:16px;z-index:2147483647;width:520px;max-width:calc(100vw - 32px);max-height:60vh;background:#0d0d17;color:#e2e8f0;border:1px solid rgba(255,255,255,.15);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.7);font-family:ui-monospace,Menlo,monospace;font-size:12px;display:none;flex-direction:column;overflow:hidden;direction:ltr}',
        '#smyar-debug-panel.open{display:flex}',
        '.smyar-dbg-header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#15152a;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}',
        '.smyar-dbg-title{font-weight:700;color:#a78bfa;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.smyar-dbg-tabs{display:flex;gap:4px}',
        '.smyar-dbg-tab{background:transparent;color:#94a3b8;border:1px solid transparent;border-radius:6px;padding:3px 8px;font-size:11px;font-family:inherit;cursor:pointer;transition:all .1s}',
        '.smyar-dbg-tab:hover{color:#e2e8f0;background:rgba(255,255,255,.05)}',
        '.smyar-dbg-tab.active{background:rgba(139,92,246,.2);color:#a78bfa;border-color:rgba(139,92,246,.4)}',
        '.smyar-dbg-action{background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 8px;font-size:11px;font-family:inherit;cursor:pointer;transition:all .1s}',
        '.smyar-dbg-action:hover{background:rgba(255,255,255,.05);color:#e2e8f0}',
        '.smyar-dbg-action.close:hover{background:rgba(239,68,68,.2);color:#fca5a5;border-color:rgba(239,68,68,.4)}',
        '.smyar-dbg-list{flex:1;overflow-y:auto;padding:4px 0}',
        '.smyar-dbg-empty{padding:40px 20px;text-align:center;color:#64748b;font-size:12px}',
        '.smyar-dbg-entry{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer;transition:background .1s}',
        '.smyar-dbg-entry:hover{background:rgba(255,255,255,.03)}',
        '.smyar-dbg-entry.error{border-left:3px solid #ef4444}',
        '.smyar-dbg-entry.warn{border-left:3px solid #f59e0b}',
        '.smyar-dbg-entry.info{border-left:3px solid #3b82f6}',
        '.smyar-dbg-entry-head{display:flex;gap:8px;align-items:flex-start}',
        '.smyar-dbg-type{font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;text-transform:uppercase;flex-shrink:0}',
        '.smyar-dbg-type.error{background:rgba(239,68,68,.2);color:#fca5a5}',
        '.smyar-dbg-type.warn{background:rgba(245,158,11,.2);color:#fcd34d}',
        '.smyar-dbg-type.info{background:rgba(59,130,246,.2);color:#93c5fd}',
        '.smyar-dbg-time{color:#64748b;font-size:10px;flex-shrink:0;margin-left:auto}',
        '.smyar-dbg-msg{flex:1;color:#e2e8f0;word-break:break-word;white-space:pre-wrap;min-width:0}',
        '.smyar-dbg-stack{margin-top:6px;padding:8px;background:rgba(0,0,0,.4);border-radius:4px;color:#94a3b8;font-size:10px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;display:none}',
        '.smyar-dbg-entry.expanded .smyar-dbg-stack{display:block}',
        '.smyar-dbg-hint{padding:6px 12px;font-size:10px;color:#64748b;text-align:center;background:#0a0a14;border-top:1px solid rgba(255,255,255,.05);flex-shrink:0}',
        '@media (max-width:600px){#smyar-debug-panel{width:calc(100vw - 32px);left:16px;right:16px;max-height:70vh}}'
      ].join('\n');
      document.head.appendChild(s);
    } catch (e) { /* swallow */ }
  }
  injectStyle();

  // ---------- UI refs ----------
  var btn = null;
  var badge = null;
  var panel = null;
  var listEl = null;

  function makeButton() {
    btn = document.createElement('button');
    btn.id = 'smyar-debug-btn';
    btn.type = 'button';
    btn.title = 'Debug Console (Ctrl+Shift+D)';
    var b = document.createElement('span');
    b.id = 'smyar-debug-badge';
    b.textContent = '0';
    var lbl = document.createElement('span');
    lbl.textContent = 'DBG';
    btn.appendChild(b);
    btn.appendChild(lbl);
    badge = b;
    btn.addEventListener('click', togglePanel);
    return btn;
  }

  function makePanel() {
    panel = document.createElement('div');
    panel.id = 'smyar-debug-panel';
    panel.innerHTML = ''
      + '<div class="smyar-dbg-header">'
      + '  <div class="smyar-dbg-title">Debug Console</div>'
      + '  <div class="smyar-dbg-tabs">'
      + '    <button class="smyar-dbg-tab active" data-filter="all">All</button>'
      + '    <button class="smyar-dbg-tab" data-filter="error">Errors</button>'
      + '    <button class="smyar-dbg-tab" data-filter="warn">Warns</button>'
      + '  </div>'
      + '  <button class="smyar-dbg-action" data-action="copy">Copy</button>'
      + '  <button class="smyar-dbg-action" data-action="clear">Clear</button>'
      + '  <button class="smyar-dbg-action close" data-action="close">&#10005;</button>'
      + '</div>'
      + '<div class="smyar-dbg-list"></div>'
      + '<div class="smyar-dbg-hint">Ctrl+Shift+D toggle &middot; Click entry for stack</div>';

    listEl = panel.querySelector('.smyar-dbg-list');

    var tabs = panel.querySelectorAll('.smyar-dbg-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          currentFilter = tab.getAttribute('data-filter');
          for (var j = 0; j < tabs.length; j++) {
            tabs[j].classList.toggle('active', tabs[j] === tab);
          }
          renderList();
        });
      })(tabs[i]);
    }

    var actions = panel.querySelectorAll('.smyar-dbg-action');
    for (var k = 0; k < actions.length; k++) {
      (function (a) {
        a.addEventListener('click', function () {
          var act = a.getAttribute('data-action');
          if (act === 'copy') copyAll();
          else if (act === 'clear') clearAll();
          else if (act === 'close') closePanel();
        });
      })(actions[k]);
    }

    return panel;
  }

  function mountUI() {
    try {
      if (!document.body) { setTimeout(mountUI, 20); return; }
      if (!document.getElementById('smyar-debug-btn')) {
        document.body.appendChild(makeButton());
      }
      if (!document.getElementById('smyar-debug-panel')) {
        document.body.appendChild(makePanel());
      }
      updateButton();
    } catch (e) { /* swallow */ }
  }
  mountUI();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountUI);
  } else {
    mountUI();
  }

  // ---------- UI updates ----------
  function updateButton() {
    try {
      if (!btn) return;
      if (errorCount > 0) {
        btn.classList.add('has-errors');
        if (badge) badge.textContent = String(errorCount);
      } else {
        btn.classList.remove('has-errors');
      }
    } catch (e) { /* swallow */ }
  }

  function renderList() {
    try {
      if (!listEl) return;
      var filtered = [];
      for (var i = 0; i < entries.length; i++) {
        if (currentFilter === 'all' || entries[i].type === currentFilter) filtered.push(entries[i]);
      }

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="smyar-dbg-empty">No entries. '
          + (currentFilter !== 'all' ? 'Try "All" tab.' : 'Console is clean.') + '</div>';
        return;
      }

      var html = '';
      for (var j = filtered.length - 1; j >= 0; j--) {
        var e = filtered[j];
        var msg = e.message.length > 400 ? e.message.slice(0, 400) + '\u2026' : e.message;
        var hasStack = !!e.stack;
        html += '<div class="smyar-dbg-entry ' + escapeHtml(e.type) + '" data-idx="' + j + '">'
          + '<div class="smyar-dbg-entry-head">'
          + '<span class="smyar-dbg-type ' + escapeHtml(e.type) + '">' + escapeHtml(e.type) + '</span>'
          + '<span class="smyar-dbg-msg">' + escapeHtml(msg) + '</span>'
          + '<span class="smyar-dbg-time">' + escapeHtml(e.ts) + '</span>'
          + '</div>'
          + (hasStack ? '<div class="smyar-dbg-stack">' + escapeHtml(e.stack) + '</div>' : '')
          + '</div>';
      }
      listEl.innerHTML = html;

      var entryEls = listEl.querySelectorAll('.smyar-dbg-entry');
      for (var n = 0; n < entryEls.length; n++) {
        entryEls[n].addEventListener('click', function () {
          this.classList.toggle('expanded');
        });
      }
    } catch (e) { /* swallow */ }
  }

  // ---------- actions ----------
  function togglePanel() {
    try {
      if (!panel) return;
      panelOpen = !panelOpen;
      if (panelOpen) {
        panel.classList.add('open');
        if (btn) btn.classList.add('acknowledged');
        renderList();
      } else {
        closePanel();
      }
    } catch (e) { /* swallow */ }
  }

  function closePanel() {
    try {
      panelOpen = false;
      if (panel) panel.classList.remove('open');
      if (btn) btn.classList.remove('acknowledged');
    } catch (e) { /* swallow */ }
  }

  function clearAll() {
    try {
      entries.length = 0;
      errorCount = 0;
      updateButton();
      renderList();
    } catch (e) { /* swallow */ }
  }

  function copyAll() {
    try {
      var out = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var line = '[' + e.ts + '] [' + e.type.toUpperCase() + '] ' + e.message;
        if (e.stack) line += '\n' + e.stack;
        out.push(line);
      }
      var text = out.join('\n\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showFeedback('Copied ' + entries.length + ' entries');
        }).catch(function () { fallbackCopy(text); });
      } else {
        fallbackCopy(text);
      }
    } catch (e) { /* swallow */ }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.parentNode.removeChild(ta);
      showFeedback(ok ? 'Copied ' + entries.length + ' entries' : 'Copy failed');
    } catch (e) { /* swallow */ }
  }

  function showFeedback(msg) {
    try {
      if (!panel) return;
      var hint = panel.querySelector('.smyar-dbg-hint');
      if (!hint) return;
      var orig = hint.textContent;
      hint.textContent = '\u2713 ' + msg;
      hint.style.color = '#10b981';
      setTimeout(function () {
        hint.textContent = orig;
        hint.style.color = '';
      }, 1600);
    } catch (e) { /* swallow */ }
  }

  // ---------- keyboard shortcut ----------
  document.addEventListener('keydown', function (ev) {
    try {
      if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === 'D' || ev.key === 'd')) {
        ev.preventDefault();
        togglePanel();
      }
    } catch (e) { /* swallow */ }
  });

  // ---------- public API for app code ----------
  window.__smyarDebugLog = function (type, msg) {
    try { add(type || 'info', msg, { source: 'manual' }); } catch (e) { /* swallow */ }
  };

  origLog.call(console, '[debug] watchdog active');
})();
