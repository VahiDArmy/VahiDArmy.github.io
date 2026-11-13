/* ==========================================================================
   watchdog.js — classic script. Loads BEFORE all modules.
   Adds a small VISIBLE floating button (bottom-left) that opens an error log.
   Also intercepts console.error/warn, window.onerror, unhandledrejection.
   Keyboard shortcut: Ctrl+Shift+L
   ========================================================================== */
(function () {
  "use strict";

  var MAX_LOGS = 500;
  var logs = [];
  var isOpen = false;
  var ui = null;
  var LOG_ID = 0;

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("wd-styles")) return;
    var style = document.createElement("style");
    style.id = "wd-styles";
    style.textContent = [
      "#wd-fab{position:fixed;bottom:14px;left:14px;z-index:2147483600;",
      "width:38px;height:38px;border-radius:50%;background:#1e1e1e;",
      "border:1px solid #3a3a3a;color:#cfcfcf;display:grid;place-items:center;",
      "cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5);",
      "transition:transform .15s,background .15s,opacity .15s;opacity:.55;",
      "font-family:ui-monospace,Menlo,monospace;font-size:16px;}",
      "#wd-fab:hover{opacity:1;transform:translateY(-1px);background:#252526;}",
      "#wd-fab.has-errors{opacity:1;background:#7a1f1f;border-color:#a52a2a;color:#fff;}",
      "#wd-fab .wd-fab__badge{position:absolute;top:-4px;right:-4px;",
      "background:#ffb454;color:#000;font-size:10px;font-weight:700;",
      "padding:1px 5px;border-radius:9px;min-width:16px;text-align:center;line-height:1.4;}",
      "#wd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);",
      "backdrop-filter:blur(4px);z-index:2147483646;display:none;",
      "flex-direction:column;padding:20px;font-family:ui-monospace,Menlo,monospace;",
      "direction:ltr;color:#d4d4d4;}",
      "#wd-overlay.is-open{display:flex;}",
      "#wd-panel{flex:1;background:#1e1e1e;border:1px solid #333;border-radius:12px;",
      "display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.8);}",
      "#wd-header{padding:12px 16px;background:#2d2d2d;display:flex;gap:10px;",
      "align-items:center;border-bottom:1px solid #333;flex-wrap:wrap;}",
      "#wd-header .wd-title{flex:1;font-weight:700;font-size:13px;color:#eee;min-width:150px;}",
      ".wd-btn{background:#3c3c3c;color:#ccc;border:none;padding:6px 12px;",
      "border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;",
      "transition:all .15s;}",
      ".wd-btn:hover{background:#4c4c4c;color:#fff;}",
      ".wd-btn-primary{background:#0e639c;color:#fff;}",
      ".wd-btn-primary:hover{background:#1177bb;}",
      ".wd-btn-danger{background:#5a1d1d;color:#ffb3b3;}",
      ".wd-btn-danger:hover{background:#7a2525;color:#fff;}",
      "#wd-list{flex:1;overflow-y:auto;padding:12px;display:flex;",
      "flex-direction:column;gap:8px;}",
      ".wd-item{display:flex;gap:10px;background:#252526;padding:10px 12px;",
      "border-radius:6px;border-left:3px solid #d33;font-size:12px;line-height:1.55;}",
      ".wd-item.wd-type-warn{border-left-color:#ffb454;}",
      ".wd-item.wd-type-info{border-left-color:#4a9eff;}",
      ".wd-item pre{flex:1;margin:0;white-space:pre-wrap;word-break:break-word;",
      "color:#d4d4d4;font-family:inherit;font-size:12px;}",
      ".wd-time{color:#888;font-size:10px;margin-bottom:4px;display:block;}",
      ".wd-item input[type=checkbox]{margin-top:4px;cursor:pointer;flex-shrink:0;}",
      ".wd-copy{background:#3c3c3c;color:#ccc;border:none;border-radius:3px;",
      "padding:3px 8px;font-size:10px;cursor:pointer;flex-shrink:0;",
      "align-self:flex-start;}",
      ".wd-copy:hover{background:#4c4c4c;color:#fff;}",
      "#wd-empty{text-align:center;color:#888;margin-top:40px;font-size:13px;}",
      "@media (max-width:600px){#wd-overlay{padding:8px;}}"
    ].join("");
    document.head.appendChild(style);
  }

  // -------------------------------------------------------------------------
  // Floating button
  // -------------------------------------------------------------------------
  function ensureFab() {
    if (document.getElementById("wd-fab")) return;
    var fab = document.createElement("button");
    fab.id = "wd-fab";
    fab.type = "button";
    fab.title = "Error log (Ctrl+Shift+L)";
    fab.setAttribute("aria-label", "Open error log");
    fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="14" rx="3"/><path d="M12 3v3M4 11h3M17 11h3M4 17h3M17 17h3M9 14h.01M15 14h.01"/></svg>';
    fab.addEventListener("click", toggle);
    document.body.appendChild(fab);
  }

  function updateFabBadge() {
    var fab = document.getElementById("wd-fab");
    if (!fab) return;
    var count = logs.filter(function(l){ return l.type === "error" || l.type === "uncaught" || l.type === "promise"; }).length;
    var badge = fab.querySelector(".wd-fab__badge");
    if (count > 0) {
      fab.classList.add("has-errors");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "wd-fab__badge";
        fab.appendChild(badge);
      }
      badge.textContent = count > 99 ? "99+" : String(count);
    } else {
      fab.classList.remove("has-errors");
      if (badge) badge.remove();
    }
  }

  // -------------------------------------------------------------------------
  // Overlay UI
  // -------------------------------------------------------------------------
  function createUI() {
    if (ui) return ui;
    injectStyles();

    var overlay = document.createElement("div");
    overlay.id = "wd-overlay";
    overlay.addEventListener("click", function(e){ if (e.target === overlay) toggle(); });

    var panel = document.createElement("div");
    panel.id = "wd-panel";

    var header = document.createElement("div");
    header.id = "wd-header";

    var title = document.createElement("span");
    title.className = "wd-title";
    title.textContent = "System Watchdog · Error Log";

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "wd-btn wd-btn-primary";
    copyBtn.textContent = "Copy Selected";
    copyBtn.onclick = copySelected;

    var copyAllBtn = document.createElement("button");
    copyAllBtn.type = "button";
    copyAllBtn.className = "wd-btn";
    copyAllBtn.textContent = "Copy All";
    copyAllBtn.onclick = copyAll;

    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "wd-btn wd-btn-danger";
    clearBtn.textContent = "Clear";
    clearBtn.onclick = clearLogs;

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "wd-btn";
    closeBtn.textContent = "Close";
    closeBtn.onclick = toggle;

    header.appendChild(title);
    header.appendChild(copyBtn);
    header.appendChild(copyAllBtn);
    header.appendChild(clearBtn);
    header.appendChild(closeBtn);

    var list = document.createElement("div");
    list.id = "wd-list";

    panel.appendChild(header);
    panel.appendChild(list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    ui = { overlay: overlay, list: list };
    return ui;
  }

  function renderLogs() {
    if (!ui) return;
    var list = ui.list;
    list.innerHTML = "";

    if (logs.length === 0) {
      list.innerHTML = '<div id="wd-empty">No errors logged.</div>';
      return;
    }

    logs.forEach(function(log) {
      var item = document.createElement("div");
      item.className = "wd-item wd-type-" + log.type;

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.id = String(log.id);

      var content = document.createElement("div");
      content.style.flex = "1";
      content.style.minWidth = "0";

      var time = document.createElement("span");
      time.className = "wd-time";
      time.textContent = "[" + log.time + "] " + log.type.toUpperCase();

      var pre = document.createElement("pre");
      pre.textContent = log.message;

      content.appendChild(time);
      content.appendChild(pre);

      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "wd-copy";
      copyBtn.textContent = "Copy";
      copyBtn.onclick = function(){
        copyText(log.message, copyBtn, "Copy");
      };

      item.appendChild(cb);
      item.appendChild(content);
      item.appendChild(copyBtn);
      list.appendChild(item);
    });
  }

  function copyText(text, btn, label) {
    var done = function(){
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function(){ btn.textContent = label || old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){
        fallbackCopy(text, done);
      });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta);
    if (cb) cb();
  }

  function copySelected() {
    if (!ui) return;
    var checked = ui.list.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) return;
    var ids = Array.prototype.map.call(checked, function(c){ return c.dataset.id; });
    var text = logs.filter(function(l){ return ids.indexOf(String(l.id)) >= 0; })
      .map(function(l){ return "[" + l.time + "] " + l.type.toUpperCase() + "\n" + l.message; })
      .join("\n\n---\n\n");
    copyText(text, ui.overlay.querySelector('.wd-btn-primary'), "Copy Selected");
  }

  function copyAll() {
    if (!ui) return;
    var text = logs.map(function(l){
      return "[" + l.time + "] " + l.type.toUpperCase() + "\n" + l.message;
    }).join("\n\n---\n\n");
    copyText(text, null);
    var btn = ui.overlay.querySelectorAll(".wd-btn")[1];
    if (btn) {
      var old = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function(){ btn.textContent = old; }, 1400);
    }
  }

  function clearLogs() {
    logs = [];
    if (ui) renderLogs();
    updateFabBadge();
  }

  function toggle() {
    if (!ui) createUI();
    isOpen = !isOpen;
    ui.overlay.classList.toggle("is-open", isOpen);
    if (isOpen) renderLogs();
  }

  function addLog(type, args) {
    var message = Array.prototype.map.call(args, function(a){
      if (a instanceof Error) return (a.stack || a.message || String(a));
      if (a && typeof a === "object") {
        try { return JSON.stringify(a, null, 2); } catch(e){ return String(a); }
      }
      return String(a);
    }).join(" ");

    var d = new Date();
    var time = d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
    logs.push({ id: ++LOG_ID, type: type, message: message, time: time });
    if (logs.length > MAX_LOGS) logs.shift();
    if (isOpen) renderLogs();
    updateFabBadge();
  }

  // -------------------------------------------------------------------------
  // Interception
  // -------------------------------------------------------------------------
  var origError = console.error;
  var origWarn = console.warn;
  var origLog = console.log;

  console.error = function() {
    try { addLog("error", arguments); } catch(e){}
    origError.apply(console, arguments);
  };
  console.warn = function() {
    try { addLog("warn", arguments); } catch(e){}
    origWarn.apply(console, arguments);
  };

  window.addEventListener("error", function(e) {
    if (e && e.message) {
      addLog("uncaught", [
        e.message,
        (e.filename || "") + ":" + (e.lineno || "?") + ":" + (e.colno || "?"),
        (e.error && e.error.stack) || ""
      ]);
    } else if (e && e.target) {
      addLog("uncaught", ["Failed to load resource: " + (e.target.src || e.target.href || e.target.tagName)]);
    }
  }, true);

  window.addEventListener("unhandledrejection", function(e) {
    var r = e && e.reason;
    addLog("promise", [
      (r && (r.message || r.toString())) || String(r),
      (r && r.stack) || ""
    ]);
  });

  window.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
      e.preventDefault();
      toggle();
    }
  });

  // -------------------------------------------------------------------------
  // Bootstrap
  // -------------------------------------------------------------------------
  function bootstrap() {
    injectStyles();
    ensureFab();
    updateFabBadge();
    origLog.call(console, "[Watchdog] active · press Ctrl+Shift+L or click the floating bug icon");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
