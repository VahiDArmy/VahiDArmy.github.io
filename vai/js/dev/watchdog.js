/* Watchdog — classic script, runs before app.js */
(function () {
  "use strict";
  var MAX_LOGS = 500;
  var logs = [];
  var isOpen = false;
  var ui = null;
  var LOG_ID = 0;

  function ensureFab() {
    if (document.getElementById("wd-fab")) return;
    var fab = document.createElement("button");
    fab.id = "wd-fab";
    fab.type = "button";
    fab.title = "Error log (Ctrl+Shift+L)";
    fab.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>';
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

  function createUI() {
    if (ui) return ui;
    var overlay = document.createElement("div");
    overlay.id = "wd-overlay";
    overlay.addEventListener("click", function(e){ if (e.target === overlay) toggle(); });
    var panel = document.createElement("div");
    panel.id = "wd-panel";
    var header = document.createElement("div");
    header.id = "wd-header";
    var title = document.createElement("span");
    title.className = "wd-title";
    title.textContent = "Watchdog · Error Log";
    var copyBtn = document.createElement("button");
    copyBtn.type = "button"; copyBtn.className = "wd-btn wd-btn-primary"; copyBtn.textContent = "Copy Selected"; copyBtn.onclick = copySelected;
    var copyAllBtn = document.createElement("button");
    copyAllBtn.type = "button"; copyAllBtn.className = "wd-btn"; copyAllBtn.textContent = "Copy All"; copyAllBtn.onclick = copyAll;
    var clearBtn = document.createElement("button");
    clearBtn.type = "button"; clearBtn.className = "wd-btn wd-btn-danger"; clearBtn.textContent = "Clear"; clearBtn.onclick = clearLogs;
    var closeBtn = document.createElement("button");
    closeBtn.type = "button"; closeBtn.className = "wd-btn"; closeBtn.textContent = "Close"; closeBtn.onclick = toggle;
    header.appendChild(title); header.appendChild(copyBtn); header.appendChild(copyAllBtn); header.appendChild(clearBtn); header.appendChild(closeBtn);
    var list = document.createElement("div");
    list.id = "wd-list";
    panel.appendChild(header); panel.appendChild(list); overlay.appendChild(panel);
    document.body.appendChild(overlay);
    ui = { overlay: overlay, list: list };
    return ui;
  }

  function renderLogs() {
    if (!ui) return;
    var list = ui.list;
    list.innerHTML = "";
    if (logs.length === 0) { list.innerHTML = '<div id="wd-empty">No errors logged.</div>'; return; }
    logs.forEach(function(log) {
      var item = document.createElement("div");
      item.className = "wd-item wd-type-" + log.type;
      var cb = document.createElement("input"); cb.type = "checkbox"; cb.dataset.id = String(log.id);
      var content = document.createElement("div"); content.style.cssText = "flex:1;min-width:0";
      var time = document.createElement("span"); time.className = "wd-time"; time.textContent = "[" + log.time + "] " + log.type.toUpperCase();
      var pre = document.createElement("pre"); pre.textContent = log.message;
      content.appendChild(time); content.appendChild(pre);
      var copyBtn = document.createElement("button"); copyBtn.type = "button"; copyBtn.className = "wd-copy"; copyBtn.textContent = "Copy";
      copyBtn.onclick = function(){ copyText(log.message, copyBtn, "Copy"); };
      item.appendChild(cb); item.appendChild(content); item.appendChild(copyBtn);
      list.appendChild(item);
    });
  }

  function copyText(text, btn, label) {
    var done = function(){ if (!btn) return; var old = btn.textContent; btn.textContent = "Copied!"; setTimeout(function(){ btn.textContent = label || old; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done).catch(function(){ fallbackCopy(text, done); }); }
    else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, cb) {
    var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta); if (cb) cb();
  }
  function copySelected() {
    if (!ui) return;
    var checked = ui.list.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) return;
    var ids = Array.prototype.map.call(checked, function(c){ return c.dataset.id; });
    var text = logs.filter(function(l){ return ids.indexOf(String(l.id)) >= 0; }).map(function(l){ return "[" + l.time + "] " + l.type.toUpperCase() + "\n" + l.message; }).join("\n\n---\n\n");
    copyText(text, ui.overlay.querySelector('.wd-btn-primary'), "Copy Selected");
  }
  function copyAll() {
    if (!ui) return;
    var text = logs.map(function(l){ return "[" + l.time + "] " + l.type.toUpperCase() + "\n" + l.message; }).join("\n\n---\n\n");
    copyText(text, null);
    var btn = ui.overlay.querySelectorAll(".wd-btn")[1];
    if (btn) { var old = btn.textContent; btn.textContent = "Copied!"; setTimeout(function(){ btn.textContent = old; }, 1400); }
  }
  function clearLogs() { logs = []; if (ui) renderLogs(); updateFabBadge(); }
  function toggle() { if (!ui) createUI(); isOpen = !isOpen; ui.overlay.classList.toggle("is-open", isOpen); if (isOpen) renderLogs(); }

  function addLog(type, args) {
    var message = Array.prototype.map.call(args, function(a){
      if (a instanceof Error) return (a.stack || a.message || String(a));
      if (a && typeof a === "object") { try { return JSON.stringify(a, null, 2); } catch(e){ return String(a); } }
      return String(a);
    }).join(" ");
    var d = new Date();
    var time = d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
    logs.push({ id: ++LOG_ID, type: type, message: message, time: time });
    if (logs.length > MAX_LOGS) logs.shift();
    if (isOpen) renderLogs();
    updateFabBadge();
  }

  var origError = console.error;
  var origWarn = console.warn;
  console.error = function() { try { addLog("error", arguments); } catch(e){} origError.apply(console, arguments); };
  console.warn = function() { try { addLog("warn", arguments); } catch(e){} origWarn.apply(console, arguments); };
  window.addEventListener("error", function(e) {
    if (e && e.message) addLog("uncaught", [e.message, (e.filename || "") + ":" + (e.lineno || "?") + ":" + (e.colno || "?"), (e.error && e.error.stack) || ""]);
    else if (e && e.target) addLog("uncaught", ["Failed to load: " + (e.target.src || e.target.href || e.target.tagName)]);
  }, true);
  window.addEventListener("unhandledrejection", function(e) {
    var r = e && e.reason;
    addLog("promise", [(r && (r.message || r.toString())) || String(r), (r && r.stack) || ""]);
  });
  window.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) { e.preventDefault(); toggle(); }
  });

  function bootstrap() {
    ensureFab();
    updateFabBadge();
    if (window.__MIRAJ_BOOT_OK__ === false) {
      // Main app may not have started yet. We'll check again in a moment.
      setTimeout(function() {
        if (window.__MIRAJ_BOOT_OK__ !== true) {
          addLog("uncaught", ["app.js did not initialize after 4 seconds. Check the Network tab for 404 on app.js or its dependencies."]);
        }
      }, 4000);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
