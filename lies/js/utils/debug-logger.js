/* ============================================================
   js/utils/debug-logger.js
   A visual UI logger that intercepts console and window errors.
   ============================================================ */

let panel = null;
let content = null;
let isOpen = false;
const logs = [];
const MAX_LOGS = 150;

/**
 * Initialize the debug logger. Patches native console methods
 * and creates the DOM elements.
 */
export function initDebugLogger() {
  if (panel) return;

  // 1. Create UI Panel
  panel = document.createElement('div');
  panel.id = 'debug-log-panel';
  panel.className = 'debug-log-panel';

  const header = document.createElement('div');
  header.className = 'debug-log-header';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-size:16px;">🛠️</span>
      <strong>وضعیت سیستم (لاگ زنده)</strong>
    </div>
    <div style="display:flex; gap: 8px;">
      <button id="debug-log-copy" class="debug-btn">کپی</button>
      <button id="debug-log-close" class="debug-btn">بستن</button>
    </div>
  `;

  content = document.createElement('div');
  content.className = 'debug-log-content';

  panel.appendChild(header);
  panel.appendChild(content);
  document.body.appendChild(panel);

  // 2. Event listeners
  header.querySelector('#debug-log-close').addEventListener('click', hideDebugLog);
  header.querySelector('#debug-log-copy').addEventListener('click', () => {
    const text = logs.map(l => `[${l.time.toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = header.querySelector('#debug-log-copy');
      btn.textContent = 'کپی شد!';
      setTimeout(() => { btn.textContent = 'کپی'; }, 2000);
    });
  });

  // 3. Splash Screen Button Hook
  const showBtn = document.getElementById('show-logs-btn');
  if (showBtn) {
    showBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showDebugLog();
    });
  }

  // 4. Patch console
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const origInfo = console.info;

  function addLog(type, args) {
    const msg = args.map(a => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');

    const logEntry = { type, message: msg, time: new Date() };
    logs.push(logEntry);
    if (logs.length > MAX_LOGS) logs.shift();

    if (content) {
      const el = document.createElement('div');
      el.className = `debug-line debug-line--${type}`;
      const timeStr = logEntry.time.toLocaleTimeString('fa-IR');
      el.textContent = `[${timeStr}] ${msg}`;
      
      content.appendChild(el);
      // Auto-scroll to bottom
      content.scrollTop = content.scrollHeight;
    }
  }

  console.log = function(...args) { origLog.apply(console, args); addLog('log', args); };
  console.warn = function(...args) { origWarn.apply(console, args); addLog('warn', args); };
  console.error = function(...args) { origError.apply(console, args); addLog('error', args); };
  console.info = function(...args) { origInfo.apply(console, args); addLog('info', args); };

  // 5. Global Error Handlers
  window.addEventListener('error', (e) => {
    addLog('error', [`Uncaught Error: ${e.message} at ${e.filename}:${e.lineno}`]);
    showDebugLog(); // Auto-open on fatal errors
  });

  window.addEventListener('unhandledrejection', (e) => {
    let reason = e.reason;
    if (reason instanceof Error) reason = reason.stack || reason.message;
    addLog('error', [`Unhandled Rejection: ${reason}`]);
    showDebugLog(); // Auto-open on fatal errors
  });

  // Log the very first message
  addLog('info', ['سیستم لاگ راه‌اندازی شد.']);
}

export function showDebugLog() {
  if (!panel) return;
  panel.classList.add('is-open');
  isOpen = true;
}

export function hideDebugLog() {
  if (!panel) return;
  panel.classList.remove('is-open');
  isOpen = false;
}

export function isDebugLogOpen() {
  return isOpen;
}