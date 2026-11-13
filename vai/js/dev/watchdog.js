/* Watchdog.js — Classic script, must load before any modules */
(function() {
  const MAX_LOGS = 500;
  let logs = [];
  let isOpen = false;
  let ui = null;

  function injectStyles() {
    if (document.getElementById("wd-styles")) return;
    const style = document.createElement("style");
    style.id = "wd-styles";
    style.textContent = `
      #sys-watchdog-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        z-index: 2147483647; display: none; flex-direction: column; padding: 24px;
        font-family: 'JetBrains Mono', monospace; direction: ltr; color: #d4d4d4;
      }
      #sys-watchdog-overlay.is-open { display: flex; }
      #sys-watchdog-panel {
        flex: 1; background: #1e1e1e; border: 1px solid #333; border-radius: 12px;
        display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      }
      #sys-watchdog-header {
        padding: 12px 16px; background: #2d2d2d; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #333;
      }
      #sys-watchdog-header span { flex: 1; font-weight: bold; font-size: 14px; color: #eee; }
      #sys-watchdog-list {
        flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      }
      .wd-item {
        display: flex; gap: 12px; background: #252526; padding: 12px; border-radius: 6px; border-left: 3px solid #f44;
        font-size: 12px; line-height: 1.5;
      }
      .wd-item pre {
        flex: 1; margin: 0; white-space: pre-wrap; word-break: break-all; color: #d4d4d4; font-family: inherit;
      }
      .wd-time { color: #888; font-size: 10px; margin-bottom: 4px; display: block; }
      .wd-btn {
        background: #3c3c3c; color: #ccc; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;
        font-family: inherit; font-size: 12px; transition: all 0.2s;
      }
      .wd-btn:hover { background: #4c4c4c; color: #fff; }
      .wd-btn-primary { background: #0e639c; color: #fff; }
      .wd-btn-primary:hover { background: #1177bb; }
      .wd-btn-danger { background: #5a1d1d; color: #ffb3b3; }
      .wd-btn-danger:hover { background: #7a2525; color: #fff; }
      .wd-item input[type="checkbox"] { margin-top: 4px; cursor: pointer; }
      #sys-watchdog-empty { text-align: center; color: #888; margin-top: 40px; font-size: 14px; }
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    if (ui) return ui;
    injectStyles();

    const overlay = document.createElement("div");
    overlay.id = "sys-watchdog-overlay";

    const panel = document.createElement("div");
    panel.id = "sys-watchdog-panel";

    const header = document.createElement("div");
    header.id = "sys-watchdog-header";
    
    const title = document.createElement("span");
    title.textContent = "System Watchdog · Error Log (Ctrl+Shift+L to toggle)";
    
    const copyBtn = document.createElement("button");
    copyBtn.className = "wd-btn wd-btn-primary";
    copyBtn.textContent = "Copy Selected";
    copyBtn.onclick = copySelected;

    const clearBtn = document.createElement("button");
    clearBtn.className = "wd-btn wd-btn-danger";
    clearBtn.textContent = "Clear All";
    clearBtn.onclick = clearLogs;

    const closeBtn = document.createElement("button");
    closeBtn.className = "wd-btn";
    closeBtn.textContent = "Close";
    closeBtn.onclick = toggle;

    header.appendChild(title);
    header.appendChild(copyBtn);
    header.appendChild(clearBtn);
    header.appendChild(closeBtn);

    const list = document.createElement("div");
    list.id = "sys-watchdog-list";

    panel.appendChild(header);
    panel.appendChild(list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    ui = { overlay, list };
    return ui;
  }

  function renderLogs() {
    if (!ui) return;
    const { list } = ui;
    list.innerHTML = "";

    if (logs.length === 0) {
      list.innerHTML = `<div id="sys-watchdog-empty">No errors logged.</div>`;
      return;
    }

    logs.forEach((log) => {
      const item = document.createElement("div");
      item.className = "wd-item";
      
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.id = log.id;

      const content = document.createElement("div");
      content.style.flex = "1";
      
      const time = document.createElement("span");
      time.className = "wd-time";
      time.textContent = `[${log.time}] ${log.type.toUpperCase()}`;
      
      const pre = document.createElement("pre");
      pre.textContent = log.message;

      content.appendChild(time);
      content.appendChild(pre);

      const copyBtn = document.createElement("button");
      copyBtn.className = "wd-btn";
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(log.message).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => copyBtn.textContent = "Copy", 1500);
        });
      };

      item.appendChild(cb);
      item.appendChild(content);
      item.appendChild(copyBtn);
      list.appendChild(item);
    });
  }

  function copySelected() {
    if (!ui) return;
    const checkboxes = ui.list.querySelectorAll('input[type="checkbox"]:checked');
    if (checkboxes.length === 0) return;
    
    const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    const text = logs
      .filter(l => selectedIds.includes(l.id))
      .map(l => `[${l.time}] ${l.type.toUpperCase()}\n${l.message}`)
      .join("\n\n---\n\n");

    navigator.clipboard.writeText(text).then(() => {
      const btn = ui.overlay.querySelector('.wd-btn-primary');
      const oldText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = oldText, 1500);
    });
  }

  function clearLogs() {
    logs = [];
    renderLogs();
  }

  function toggle() {
    if (!ui) createUI();
    isOpen = !isOpen;
    ui.overlay.classList.toggle("is-open", isOpen);
    if (isOpen) renderLogs();
  }

  function addLog(type, ...args) {
    const message = args.map(a => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') {
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
      }
      return String(a);
    }).join(" ");

    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    logs.push({ id: Math.random().toString(36).slice(2), type, message, time });
    if (logs.length > MAX_LOGS) logs.shift();
    if (isOpen) renderLogs();
  }

  const origError = console.error;
  const origWarn = console.warn;
  
  console.error = function(...args) {
    addLog("error", ...args);
    origError.apply(console, args);
  };
  console.warn = function(...args) {
    addLog("warn", ...args);
    origWarn.apply(console, args);
  };

  window.addEventListener("error", (e) => {
    addLog("uncaught", e.message || "Unknown script error", e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "", e.error?.stack || "");
  });

  window.addEventListener("unhandledrejection", (e) => {
    addLog("promise", e.reason?.message || e.reason, e.reason?.stack || "");
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      toggle();
    }
  });

  console.info("Watchdog active. Press Ctrl+Shift+L to open the error log.");
})();
