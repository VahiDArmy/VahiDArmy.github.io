/* ============================================================
   NEXUS CHAT — CLOUD SYNC ENGINE
   Requires authenticated user. Uses ONLY nexus_* tables.
   No namespace — RLS scopes rows to auth.uid().
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_cloudsync_loaded__) return;
  window.__nexus_cloudsync_loaded__ = true;

  const QUEUE_KEY = 'nexus_cloud_queue_v1';
  const MAX_QUEUE_SIZE = 500;
  const MAX_RETRY_ATTEMPTS = 8;
  const BASE_BACKOFF_MS = 800;
  const MAX_BACKOFF_MS = 60000;
  const PUSH_DEBOUNCE_MS = 1200;
  const STATUS_POLL_INTERVAL = 4000;
  const MAX_KEY_VALUE_BYTES = 512 * 1024;

  const state = {
    client: null,
    clientReady: false,
    authUser: null,
    online: navigator.onLine,
    cloudReachable: null,
    lastSyncAt: null,
    lastSyncError: null,
    lastSyncOk: null,
    queue: [],
    queueRunning: false,
    pushDebounceTimers: {},
    stats: { pushed: 0, pulled: 0, failed: 0, retried: 0, since: Date.now() },
    statusEl: null,
    overlayEl: null,
    pollHandle: null,
  };

  /* ---------- Client ---------- */
  async function initClient() {
    let tries = 0;
    while (!window.supabase && tries < 50) { await sleep(100); tries++; }
    if (!window.supabase) {
      state.clientReady = false;
      state.lastSyncError = 'Supabase client not available';
      return false;
    }
    state.client = window.supabase;
    state.clientReady = true;
    try {
      const { data } = await state.client.auth.getSession();
      state.authUser = data?.session?.user || null;
    } catch (e) {
      state.authUser = null;
    }
    state.client.auth.onAuthStateChange((event, session) => {
      const prevUserId = state.authUser?.id || null;
      state.authUser = session?.user || null;
      const newUserId = state.authUser?.id || null;
      if (prevUserId !== newUserId) {
        state.queue = [];
        saveQueue();
      }
      renderStatus();
      if (state.authUser && state.queue.length) flushQueue();
    });
    return true;
  }

  function isReady() {
    return state.clientReady && !!state.authUser;
  }
  function isAuthenticated() { return !!state.authUser; }

  /* ---------- Queue ---------- */
  function loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) state.queue = arr.filter(it => it && it.op && it.key);
      }
    } catch (e) { state.queue = []; }
  }
  function saveQueue() {
    try {
      if (state.queue.length > MAX_QUEUE_SIZE) state.queue = state.queue.slice(-MAX_QUEUE_SIZE);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(state.queue));
    } catch (e) {}
  }

  function push(key, value) {
    if (!key) return;
    if (!isReady()) return;
    let serialized;
    try {
      serialized = typeof value === 'string' ? value : JSON.stringify(value);
    } catch (e) {
      state.lastSyncError = `Serialize failed for ${key}: ${e.message}`;
      renderStatus();
      return;
    }
    if (serialized.length > MAX_KEY_VALUE_BYTES) {
      state.lastSyncError = `Value too large for ${key} (${humanBytes(serialized.length)})`;
      renderStatus();
      return;
    }
    state.queue = state.queue.filter(it => !(it.op !== 'delete' && it.key === key));
    state.queue.push({
      id: genUUID(), op: 'upsert', key, value: serialized,
      ts: Date.now(), attempts: 0, lastError: null,
    });
    saveQueue();
    renderStatus();
    if (state.pushDebounceTimers[key]) clearTimeout(state.pushDebounceTimers[key]);
    state.pushDebounceTimers[key] = setTimeout(() => {
      delete state.pushDebounceTimers[key];
      flushQueue();
    }, PUSH_DEBOUNCE_MS);
  }

  function pushDelete(key) {
    if (!key || !isReady()) return;
    state.queue = state.queue.filter(it => !(it.key === key));
    state.queue.push({
      id: genUUID(), op: 'delete', key,
      ts: Date.now(), attempts: 0, lastError: null,
    });
    saveQueue();
    renderStatus();
    flushQueue();
  }

  async function pull(key) {
    if (!isReady()) throw new Error('Not authenticated');
    const { data, error } = await state.client
      .from('nexus_kv')
      .select('v')
      .eq('k', key)
      .limit(1);
    if (error) throw new Error(`Pull ${key}: ${error.message}`);
    if (!data || !data.length) return null;
    try { return JSON.parse(data[0].v); } catch (e) { return data[0].v; }
  }

  async function executeOp(item) {
    if (!state.client) throw new Error('No client');
    if (!state.authUser) throw new Error('Not authenticated');
    if (item.op === 'delete') {
      const { error } = await state.client.from('nexus_kv').delete().eq('k', item.key);
      if (error) throw new Error(error.message);
      return;
    }
    const { error } = await state.client
      .from('nexus_kv')
      .upsert({
        k: item.key,
        v: item.value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,k' });
    if (error) throw new Error(error.message);
  }

  async function flushQueue() {
    if (state.queueRunning) return;
    if (!state.queue.length) return;
    if (!isReady()) { renderStatus(); return; }
    if (!state.online) { renderStatus(); return; }

    state.queueRunning = true;
    renderStatus();
    const stillPending = [];
    try {
      while (state.queue.length) {
        if (!state.authUser) break;
        const item = state.queue.shift();
        if (!item) break;
        const delay = backoffFor(item.attempts);
        const age = Date.now() - item.ts;
        if (item.attempts > 0 && age < delay) { stillPending.push(item); continue; }
        try {
          await executeOp(item);
          state.stats.pushed++;
          state.lastSyncAt = new Date().toISOString();
          state.lastSyncOk = true;
          state.lastSyncError = null;
          state.cloudReachable = true;
        } catch (err) {
          item.attempts++;
          item.lastError = err.message || String(err);
          state.stats.failed++;
          state.lastSyncError = item.lastError;
          state.lastSyncOk = false;
          if (/network|fetch|timeout|abort/i.test(item.lastError)) state.cloudReachable = false;
          if (item.attempts < MAX_RETRY_ATTEMPTS) {
            state.stats.retried++;
            item.ts = Date.now();
            stillPending.push(item);
          }
        }
      }
    } finally {
      state.queue = stillPending.concat(state.queue);
      saveQueue();
      state.queueRunning = false;
      renderStatus();
      renderOverlayIfOpen();
    }
  }

  function backoffFor(n) {
    if (n <= 0) return 0;
    return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, n - 1));
  }

  /* ---------- Sync ---------- */
  async function syncAll() {
    if (!state.clientReady) await initClient();
    if (!state.authUser) return { ok: false, error: 'Not signed in' };
    await flushQueue();
    const results = {};
    try {
      if (window.Nexus.CloudSettings?.syncFromCloud) results.settings = await window.Nexus.CloudSettings.syncFromCloud();
      if (window.Nexus.CloudConversations?.syncFromCloud) results.conversations = await window.Nexus.CloudConversations.syncFromCloud();
    } catch (e) { results.error = e.message; }
    state.lastSyncAt = new Date().toISOString();
    renderStatus(); renderOverlayIfOpen();
    return { ok: true, results };
  }

  function isOnline() { return state.online && navigator.onLine !== false; }

  async function probeCloud() {
    if (!isReady()) { state.cloudReachable = null; return false; }
    try {
      const { error } = await state.client.from('nexus_kv').select('k').limit(1);
      if (error) {
        state.cloudReachable = false;
        state.lastSyncError = error.message;
        return false;
      }
      state.cloudReachable = true;
      return true;
    } catch (e) {
      state.cloudReachable = false;
      state.lastSyncError = e.message;
      return false;
    }
  }

  /* ---------- UI ---------- */
  function injectStyles() {
    if (document.getElementById('nx-cloud-styles')) return;
    const css = `
.nx-cloud-dot{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;border:1.5px solid var(--bg-tertiary);background:var(--text-tertiary);transition:background .2s;}
.nx-cloud-dot.ok{background:var(--success);} .nx-cloud-dot.pending{background:var(--warning);animation:nx-cloud-pulse 1.4s infinite;}
.nx-cloud-dot.syncing{background:var(--info);animation:nx-cloud-pulse .8s infinite;} .nx-cloud-dot.error{background:var(--danger);}
.nx-cloud-dot.off{background:var(--text-tertiary);opacity:.5;} .nx-cloud-dot.idle{background:var(--accent-secondary);}
@keyframes nx-cloud-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(1.15);}}
.nx-cloud-overlay{position:fixed;inset:0;z-index:2820;background:rgba(4,4,10,.85);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .2s;}
.nx-cloud-overlay.open{opacity:1;pointer-events:auto;}
.nx-cloud-modal{width:100%;max-width:720px;max-height:90vh;background:var(--bg-secondary);border:1px solid var(--border-strong);border-radius:16px;box-shadow:0 32px 80px rgba(0,0,0,.7);display:flex;flex-direction:column;overflow:hidden;transform:scale(.96);transition:transform .2s;}
.nx-cloud-overlay.open .nx-cloud-modal{transform:scale(1);}
.nx-cloud-header{padding:16px 22px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.nx-cloud-title{font-size:16px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:10px;}
.nx-cloud-title svg{color:var(--accent-secondary);}
.nx-cloud-body{flex:1;overflow-y:auto;padding:18px 22px;}
.nx-cloud-section{margin-bottom:22px;}
.nx-cloud-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--text-tertiary);margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.nx-cloud-section-title::after{content:'';flex:1;height:1px;background:var(--border-subtle);}
.nx-cloud-status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.nx-cloud-stat{padding:12px 14px;background:var(--bg-tertiary);border:1px solid var(--border-subtle);border-radius:8px;}
.nx-cloud-stat-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:6px;}
.nx-cloud-stat-value{font-size:18px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);line-height:1.1;}
.nx-cloud-stat-value.ok{color:var(--success);} .nx-cloud-stat-value.warn{color:var(--warning);} .nx-cloud-stat-value.err{color:var(--danger);}
.nx-cloud-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);}
.nx-cloud-row:last-child{border-bottom:none;}
.nx-cloud-row-label{font-size:12px;color:var(--text-primary);}
.nx-cloud-row-value{font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);text-align:right;word-break:break-all;}
.nx-cloud-row-value.ok{color:var(--success);}
.nx-cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
.nx-cloud-btn{padding:8px 16px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-tertiary);color:var(--text-primary);font-family:var(--font-sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;}
.nx-cloud-btn:hover:not(:disabled){background:var(--bg-hover);border-color:var(--border-strong);}
.nx-cloud-btn.primary{background:var(--accent-primary);border-color:var(--accent-primary);color:#fff;}
.nx-cloud-btn.primary:hover:not(:disabled){background:var(--accent-secondary);}
.nx-cloud-btn.danger{color:var(--danger);border-color:rgba(225,112,85,.4);background:transparent;}
.nx-cloud-btn.danger:hover:not(:disabled){background:rgba(225,112,85,.12);border-color:var(--danger);}
.nx-cloud-btn:disabled{opacity:.4;cursor:not-allowed;}
.nx-cloud-queue{max-height:200px;overflow-y:auto;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;padding:4px;}
.nx-cloud-queue-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:5px;font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);border-bottom:1px solid var(--border-subtle);}
.nx-cloud-queue-item:last-child{border-bottom:none;}
.nx-cloud-queue-item .op{padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.nx-cloud-queue-item .op.upsert{background:rgba(0,184,148,.2);color:var(--success);} .nx-cloud-queue-item .op.delete{background:rgba(225,112,85,.2);color:var(--danger);}
.nx-cloud-queue-item .key{flex:1;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nx-cloud-queue-empty{padding:24px;text-align:center;color:var(--text-tertiary);font-size:12px;}
.nx-cloud-footer{padding:12px 22px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;background:var(--bg-tertiary);font-size:11px;color:var(--text-tertiary);}
.nx-cloud-signed-out{padding:24px;text-align:center;color:var(--text-tertiary);font-size:12px;line-height:1.6;}
@media (max-width:700px){.nx-cloud-overlay{padding:10px;}.nx-cloud-modal{max-height:95vh;}.nx-cloud-status-grid{grid-template-columns:repeat(2,1fr);}}
`;
    const style = document.createElement('style');
    style.id = 'nx-cloud-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mountStatusIndicator() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar || document.getElementById('nxCloudBtn')) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxCloudBtn';
    btn.title = 'Cloud sync';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4.5 12h7a3 3 0 000-6 4 4 0 00-7.75-.75A3.25 3.25 0 004.5 12z"/>
      </svg>
      <span class="nx-cloud-dot" id="nxCloudDot"></span>`;
    btn.addEventListener('click', open);
    topBar.insertBefore(btn, topBar.firstChild);
    state.statusEl = btn;
  }

  function renderStatus() {
    if (!state.statusEl) return;
    const dot = state.statusEl.querySelector('#nxCloudDot');
    if (!dot) return;
    let cls = 'off', title = 'Not signed in';
    if (!state.authUser) { cls = 'off'; title = 'Not signed in'; }
    else if (!state.online) { cls = 'off'; title = 'Offline — will sync when reconnected'; }
    else if (!state.clientReady) { cls = 'off'; title = 'Cloud not ready'; }
    else if (state.queueRunning) { cls = 'syncing'; title = `Syncing ${state.queue.length}…`; }
    else if (state.queue.length > 0) { cls = 'pending'; title = `${state.queue.length} change(s) pending`; }
    else if (state.lastSyncOk === false) { cls = 'error'; title = `Last sync failed: ${state.lastSyncError || 'unknown'}`; }
    else if (state.lastSyncOk === true) { cls = 'ok'; title = `Synced ${formatAgo(state.lastSyncAt)}`; }
    else { cls = 'idle'; title = 'Cloud ready'; }
    dot.className = 'nx-cloud-dot ' + cls;
    state.statusEl.title = title;
  }

  function bindConnectivity() {
    window.addEventListener('online', () => { state.online = true; renderStatus(); flushQueue(); probeCloud().then(renderStatus); });
    window.addEventListener('offline', () => { state.online = false; renderStatus(); });
    window.addEventListener('nexus:auth-changed', () => {
      renderStatus();
      if (state.authUser) {
        flushQueue();
        probeCloud().then(renderStatus);
      }
    });
  }

  function buildModal() {
    if (state.overlayEl) return;
    const overlay = document.createElement('div');
    overlay.className = 'nx-cloud-overlay';
    overlay.id = 'nxCloudOverlay';
    overlay.innerHTML = `
      <div class="nx-cloud-modal" role="dialog" aria-modal="true" aria-label="Cloud sync">
        <div class="nx-cloud-header">
          <div class="nx-cloud-title">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4.5 12h7a3 3 0 000-6 4 4 0 00-7.75-.75A3.25 3.25 0 004.5 12z"/>
            </svg>
            Cloud Sync
          </div>
          <button class="icon-btn" id="nxCloudClose" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3l8 8M11 3l-8 8"/>
            </svg>
          </button>
        </div>
        <div class="nx-cloud-body" id="nxCloudBody"></div>
        <div class="nx-cloud-footer">
          <span id="nxCloudFooterText">—</span>
          <button class="nx-cloud-btn" id="nxCloudCloseBtn">Close</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    state.overlayEl = overlay;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#nxCloudClose').addEventListener('click', close);
    overlay.querySelector('#nxCloudCloseBtn').addEventListener('click', close);
  }

  function renderOverlayIfOpen() {
    if (!state.overlayEl || !state.overlayEl.classList.contains('open')) return;
    renderOverlayBody();
  }

  function renderOverlayBody() {
    if (!state.overlayEl) return;
    const body = state.overlayEl.querySelector('#nxCloudBody');
    if (!body) return;
    body.innerHTML = '';

    if (!state.authUser) {
      body.innerHTML = `<div class="nx-cloud-signed-out">
        You are not signed in.<br>
        Sign in to enable cloud sync.
      </div>`;
      return;
    }

    const userEmail = state.authUser.email || 'Signed in';
    const pendingCount = state.queue.length;
    const connLabel = !state.online ? 'Offline' : state.clientReady ? 'Connected' : 'Not ready';
    const connClass = !state.online ? 'err' : state.clientReady ? (state.cloudReachable === false ? 'err' : 'ok') : 'warn';
    const syncLabel = state.lastSyncOk === true ? formatAgo(state.lastSyncAt) : state.lastSyncOk === false ? 'Failed' : '—';
    const syncClass = state.lastSyncOk === true ? 'ok' : state.lastSyncOk === false ? 'err' : '';

    body.innerHTML += `
      <div class="nx-cloud-section">
        <div class="nx-cloud-section-title">Account</div>
        <div class="nx-cloud-row">
          <div class="nx-cloud-row-label">Signed in as</div>
          <div class="nx-cloud-row-value ok">${escapeHtml(userEmail)}</div>
        </div>
        <div class="nx-cloud-row">
          <div class="nx-cloud-row-label">Account ID</div>
          <div class="nx-cloud-row-value">${escapeHtml((state.authUser.id || '').slice(0, 8))}…${escapeHtml((state.authUser.id || '').slice(-4))}</div>
        </div>
      </div>
      <div class="nx-cloud-section">
        <div class="nx-cloud-section-title">Status</div>
        <div class="nx-cloud-status-grid">
          <div class="nx-cloud-stat"><div class="nx-cloud-stat-label">Connection</div><div class="nx-cloud-stat-value ${connClass}" style="font-size:13px;">${connLabel}</div></div>
          <div class="nx-cloud-stat"><div class="nx-cloud-stat-label">Pending</div><div class="nx-cloud-stat-value ${pendingCount ? 'warn' : 'ok'}">${pendingCount}</div></div>
          <div class="nx-cloud-stat"><div class="nx-cloud-stat-label">Last sync</div><div class="nx-cloud-stat-value ${syncClass}" style="font-size:13px;">${syncLabel}</div></div>
          <div class="nx-cloud-stat"><div class="nx-cloud-stat-label">Pushed</div><div class="nx-cloud-stat-value">${state.stats.pushed}</div></div>
        </div>
      </div>`;

    const actionsSection = document.createElement('div');
    actionsSection.className = 'nx-cloud-section';
    actionsSection.innerHTML = `
      <div class="nx-cloud-section-title">Actions</div>
      <div class="nx-cloud-actions">
        <button class="nx-cloud-btn primary" id="nxCloudSyncNow">Sync now</button>
        <button class="nx-cloud-btn" id="nxCloudRetry" ${state.queue.length ? '' : 'disabled'}>Retry queue (${state.queue.length})</button>
        <button class="nx-cloud-btn" id="nxCloudPull">Pull all</button>
        <button class="nx-cloud-btn danger" id="nxCloudWipeQueue" ${state.queue.length ? '' : 'disabled'}>Clear queue</button>
      </div>`;
    body.appendChild(actionsSection);

    const queueSection = document.createElement('div');
    queueSection.className = 'nx-cloud-section';
    queueSection.innerHTML = `<div class="nx-cloud-section-title">Pending queue (${state.queue.length})</div>`;
    if (!state.queue.length) {
      queueSection.innerHTML += `<div class="nx-cloud-queue-empty">Nothing waiting to sync.</div>`;
    } else {
      const queueEl = document.createElement('div');
      queueEl.className = 'nx-cloud-queue';
      for (const item of state.queue.slice(0, 50)) {
        const row = document.createElement('div');
        row.className = 'nx-cloud-queue-item';
        row.innerHTML = `<span class="op ${item.op}">${item.op}</span><span class="key">${escapeHtml(item.key)}</span>${item.attempts ? `<span style="color:var(--warning);">×${item.attempts}</span>` : ''}`;
        queueEl.appendChild(row);
      }
      queueSection.appendChild(queueEl);
    }
    body.appendChild(queueSection);

    if (state.lastSyncError) {
      const errSection = document.createElement('div');
      errSection.className = 'nx-cloud-section';
      errSection.innerHTML = `<div class="nx-cloud-section-title" style="color:var(--danger);">Last error</div><div class="nx-cloud-queue"><div style="padding:10px 12px;font-family:var(--font-mono);font-size:11px;color:var(--danger);word-break:break-all;">${escapeHtml(state.lastSyncError)}</div></div>`;
      body.appendChild(errSection);
    }

    body.querySelector('#nxCloudSyncNow')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'Syncing…';
      const res = await syncAll();
      btn.disabled = false;
      btn.textContent = original;
      window.__nexus?.showToast?.(res.ok ? 'Sync complete' : `Sync failed: ${res.error}`, res.ok ? 'success' : 'error', 3000);
      renderOverlayBody();
    });
    body.querySelector('#nxCloudRetry')?.addEventListener('click', () => {
      for (const it of state.queue) it.attempts = 0;
      saveQueue(); flushQueue();
    });
    body.querySelector('#nxCloudPull')?.addEventListener('click', async () => {
      if (!confirm('Pull all cloud data and merge into local?')) return;
      const res = await syncAll();
      window.__nexus?.showToast?.(res.ok ? 'Pulled from cloud' : `Pull failed: ${res.error}`, res.ok ? 'success' : 'error', 3000);
      renderOverlayBody();
    });
    body.querySelector('#nxCloudWipeQueue')?.addEventListener('click', () => {
      if (!confirm('Discard pending writes? Cloud data is not deleted — only the local retry queue.')) return;
      state.queue = [];
      saveQueue(); renderStatus(); renderOverlayBody();
    });
  }

  function open() { buildModal(); renderOverlayBody(); state.overlayEl.classList.add('open'); probeCloud().then(renderOverlayIfOpen); }
  function close() { if (state.overlayEl) state.overlayEl.classList.remove('open'); }

  /* ---------- Utils ---------- */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function genUUID() { return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9); }
  function escapeHtml(s) { if (s == null) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function humanBytes(n) { if (!n) return '0 B'; if (n < 1024) return n + ' B'; if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB'; return (n/(1024*1024)).toFixed(2) + ' MB'; }
  function formatAgo(iso) { if (!iso) return '—'; const ts = typeof iso === 'number' ? iso : new Date(iso).getTime(); const diff = Date.now() - ts; if (diff < 5000) return 'just now'; if (diff < 60000) return `${Math.round(diff/1000)}s ago`; if (diff < 3600000) return `${Math.round(diff/60000)}m ago`; if (diff < 86400000) return `${Math.round(diff/3600000)}h ago`; return new Date(ts).toLocaleDateString(); }

  function getStatus() {
    return {
      online: state.online,
      clientReady: state.clientReady,
      supabaseReady: state.clientReady && !!state.authUser,
      authenticated: !!state.authUser,
      userEmail: state.authUser?.email || null,
      userId: state.authUser?.id || null,
      cloudReachable: state.cloudReachable,
      queueSize: state.queue.length,
      lastSyncAt: state.lastSyncAt,
      lastSyncOk: state.lastSyncOk,
      lastSyncError: state.lastSyncError,
      stats: { ...state.stats },
    };
  }

  /* ---------- Boot ---------- */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(async () => {
    injectStyles();
    loadQueue();
    mountStatusIndicator();
    bindConnectivity();
    await initClient();
    renderStatus();
    probeCloud().then(renderStatus);
    setTimeout(() => flushQueue(), 2000);
    state.pollHandle = setInterval(() => {
      if (state.authUser && state.online && state.queue.length) flushQueue();
    }, STATUS_POLL_INTERVAL);
    import('./cloud-settings.js').catch(err => console.debug('[cloud]', err.message));
    import('./cloud-conversations.js').catch(err => console.debug('[cloud]', err.message));
  });

  window.Nexus = window.Nexus || {};
  window.Nexus.Cloud = {
    getStatus,
    open, close,
    push, pushDelete, pull,
    syncAll,
    retryNow: () => { for (const it of state.queue) it.attempts = 0; saveQueue(); return flushQueue(); },
    isOnline,
    isAuthenticated,
  };
})();
