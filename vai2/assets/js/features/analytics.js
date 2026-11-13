/* ============================================================
   NEXUS CHAT — ANALYTICS DASHBOARD
   Tracks sends, responses, ratings, and lets you explore the
   data visually.

   Storage: nexus_analytics_events_v1 (array, capped at 5000)
   Event shape: { t: 'send'|'resp'|'rate', ts, c: chatId, m: modelId,
                  tok?, lat?, ok?, v? }

   Public API:
     window.Nexus.Analytics.open()
     window.Nexus.Analytics.close()
     window.Nexus.Analytics.track(type, payload)
     window.Nexus.Analytics.getSummary(range)
     window.Nexus.Analytics.exportCsv()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_analytics_loaded__) return;
  window.__nexus_analytics_loaded__ = true;

  const STORAGE_KEY = 'nexus_analytics_events_v1';
  const MAX_EVENTS = 5000;

  const state = {
    events: [],
    overlayEl: null,
    range: '7d',        // 'today' | '7d' | '30d' | 'all'
    tab: 'overview',    // 'overview' | 'models' | 'ratings' | 'activity'
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-analytics-styles')) return;
    const css = `
.nx-an-overlay {
  position: fixed; inset: 0; z-index: 2800;
  background: rgba(4, 4, 10, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s;
}
.nx-an-overlay.open { opacity: 1; pointer-events: auto; }
.nx-an-modal {
  width: 100%; max-width: 1000px; max-height: 92vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
  display: flex; flex-direction: column; overflow: hidden;
  transform: scale(0.96); transition: transform 0.2s;
}
.nx-an-overlay.open .nx-an-modal { transform: scale(1); }
.nx-an-header {
  padding: 16px 22px; border-bottom: 1px solid var(--border-subtle);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.nx-an-title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  display: flex; align-items: center; gap: 10px;
}
.nx-an-title svg { color: var(--accent-secondary); }
.nx-an-range {
  display: flex; gap: 4px;
  background: var(--bg-tertiary); padding: 3px;
  border-radius: 8px; border: 1px solid var(--border-subtle);
}
.nx-an-range-btn {
  padding: 5px 11px; border-radius: 5px;
  border: none; background: transparent; color: var(--text-secondary);
  font-family: var(--font-sans); font-size: 11px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.nx-an-range-btn:hover { color: var(--text-primary); }
.nx-an-range-btn.active { background: var(--accent-primary); color: #fff; font-weight: 600; }
.nx-an-tabs {
  display: flex; gap: 2px; padding: 0 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0; background: var(--bg-secondary);
}
.nx-an-tab {
  padding: 12px 16px; background: transparent; border: none;
  color: var(--text-tertiary); font-family: var(--font-sans);
  font-size: 13px; font-weight: 500; cursor: pointer;
  border-bottom: 2px solid transparent; transition: all 0.15s;
  white-space: nowrap; position: relative; top: 1px;
}
.nx-an-tab:hover { color: var(--text-secondary); }
.nx-an-tab.active { color: var(--accent-secondary); border-bottom-color: var(--accent-primary); }
.nx-an-body { flex: 1; overflow-y: auto; padding: 18px 22px; }
.nx-an-stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 10px; margin-bottom: 20px;
}
.nx-an-stat {
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
}
.nx-an-stat-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-tertiary); margin-bottom: 8px;
}
.nx-an-stat-value {
  font-size: 24px; font-weight: 800; color: var(--text-primary);
  font-family: var(--font-mono); line-height: 1;
}
.nx-an-stat-sub {
  font-size: 11px; color: var(--text-tertiary); margin-top: 6px;
  font-family: var(--font-sans);
}
.nx-an-stat-sub.up { color: var(--success); }
.nx-an-stat-sub.down { color: var(--danger); }

.nx-an-section {
  margin-bottom: 22px;
}
.nx-an-section-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-tertiary);
  margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
}
.nx-an-section-title::after {
  content: ''; flex: 1; height: 1px; background: var(--border-subtle);
}

/* Bar chart */
.nx-an-bars {
  display: flex; align-items: flex-end; gap: 4px;
  height: 120px; padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.nx-an-bar-wrap {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
  height: 100%; justify-content: flex-end;
  position: relative;
}
.nx-an-bar {
  width: 100%; min-height: 2px;
  background: linear-gradient(180deg, var(--accent-secondary), var(--accent-primary));
  border-radius: 3px 3px 0 0;
  transition: all 0.2s;
  position: relative;
}
.nx-an-bar:hover { filter: brightness(1.2); }
.nx-an-bar-tooltip {
  position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
  padding: 4px 8px; background: var(--bg-elevated); color: var(--text-primary);
  border: 1px solid var(--border-strong); border-radius: 4px;
  font-size: 10px; font-family: var(--font-mono); white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity 0.15s;
  z-index: 10;
}
.nx-an-bar:hover .nx-an-bar-tooltip { opacity: 1; }
.nx-an-bar-label {
  font-size: 9px; color: var(--text-tertiary); font-family: var(--font-mono);
  text-align: center; margin-top: 4px;
}

/* Model list */
.nx-an-model-list { display: flex; flex-direction: column; gap: 6px; }
.nx-an-model-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}
.nx-an-model-rank {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--bg-elevated); color: var(--text-tertiary);
  font-family: var(--font-mono); font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.nx-an-model-rank.top { background: var(--accent-primary); color: #fff; }
.nx-an-model-body { flex: 1; min-width: 0; }
.nx-an-model-name {
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nx-an-model-meta {
  font-size: 10px; color: var(--text-tertiary);
  font-family: var(--font-mono); margin-top: 2px;
}
.nx-an-model-bar-wrap {
  width: 80px; height: 6px;
  background: var(--bg-elevated); border-radius: 3px;
  overflow: hidden; flex-shrink: 0;
}
.nx-an-model-bar {
  height: 100%; background: var(--accent-primary); border-radius: 3px;
}
.nx-an-model-count {
  font-family: var(--font-mono); font-size: 12px; font-weight: 700;
  color: var(--accent-secondary); min-width: 30px; text-align: right;
}

/* Activity log */
.nx-an-log { display: flex; flex-direction: column; gap: 3px; }
.nx-an-log-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  border-radius: 5px;
}
.nx-an-log-row:hover { background: var(--bg-tertiary); }
.nx-an-log-time { color: var(--text-tertiary); min-width: 90px; }
.nx-an-log-icon { font-size: 12px; min-width: 20px; }
.nx-an-log-detail { flex: 1; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nx-an-log-badge {
  padding: 1px 6px; background: var(--bg-elevated); border-radius: 100px;
  font-size: 9px; color: var(--text-tertiary);
}

.nx-an-empty {
  padding: 40px 20px; text-align: center;
  color: var(--text-tertiary); font-size: 12px;
}
.nx-an-footer {
  padding: 12px 22px; border-top: 1px solid var(--border-subtle);
  display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0; background: var(--bg-tertiary);
  font-size: 11px; color: var(--text-tertiary);
}
.nx-an-footer-btn {
  padding: 6px 12px; border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary); color: var(--text-primary);
  font-family: var(--font-sans); font-size: 11px;
  cursor: pointer; transition: all 0.15s;
}
.nx-an-footer-btn:hover { background: var(--bg-hover); }
.nx-an-footer-btn.danger { color: var(--danger); border-color: rgba(225,112,85,0.4); }

@media (max-width: 700px) {
  .nx-an-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .nx-an-modal { max-height: 95vh; }
  .nx-an-overlay { padding: 10px; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-analytics-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     TRACKING
     ============================================================ */
  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) state.events = arr;
      }
    } catch (e) {}
  }
  function saveEvents() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events)); } catch (e) {}
  }
  function track(type, payload) {
    try {
      const ev = {
        t: type,
        ts: Date.now(),
        ...payload,
      };
      state.events.push(ev);
      if (state.events.length > MAX_EVENTS) {
        state.events = state.events.slice(-MAX_EVENTS);
      }
      // Save debounced — cap savings to avoid thrash
      if (!track._scheduled) {
        track._scheduled = true;
        setTimeout(() => {
          track._scheduled = false;
          saveEvents();
        }, 500);
      }
    } catch (e) {}
  }

  /* ============================================================
     RANGE PARSING
     ============================================================ */
  function rangeStart(range) {
    const now = Date.now();
    switch (range) {
      case 'today': {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }
      case '7d': return now - 7 * 864e5;
      case '30d': return now - 30 * 864e5;
      case 'all': return 0;
      default: return now - 7 * 864e5;
    }
  }

  /* ============================================================
     SUMMARY
     ============================================================ */
  function getSummary(range) {
    const start = rangeStart(range);
    const events = state.events.filter(e => e.ts >= start);

    const sends = events.filter(e => e.t === 'send');
    const resps = events.filter(e => e.t === 'resp');
    const rates = events.filter(e => e.t === 'rate');

    const okResps = resps.filter(e => e.ok !== false);
    const failedResps = resps.filter(e => e.ok === false);
    const totalTokens = resps.reduce((s, r) => s + (r.tok || 0), 0);
    const totalLatency = okResps.reduce((s, r) => s + (r.lat || 0), 0);
    const avgLatency = okResps.length ? Math.round(totalLatency / okResps.length) : 0;

    // Per-day
    const perDay = {};
    for (const e of events) {
      if (e.t !== 'send' && e.t !== 'resp') continue;
      const d = new Date(e.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!perDay[key]) perDay[key] = { sends: 0, tokens: 0 };
      if (e.t === 'send') perDay[key].sends++;
      if (e.t === 'resp' && e.tok) perDay[key].tokens += e.tok;
    }

    // Per-model
    const perModel = {};
    for (const r of resps) {
      const m = r.m || 'unknown';
      if (!perModel[m]) perModel[m] = { count: 0, tokens: 0, latency: 0, ok: 0, failed: 0 };
      perModel[m].count++;
      perModel[m].tokens += r.tok || 0;
      perModel[m].latency += r.lat || 0;
      if (r.ok === false) perModel[m].failed++;
      else perModel[m].ok++;
    }

    // Ratings
    const up = rates.filter(r => r.v === 1).length;
    const down = rates.filter(r => r.v === -1).length;

    return {
      events: events.length,
      sends: sends.length,
      responses: resps.length,
      okResponses: okResps.length,
      failedResponses: failedResps.length,
      totalTokens,
      avgLatency,
      perDay,
      perModel,
      ratings: { up, down, total: up + down },
    };
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function buildModal() {
    if (state.overlayEl) return;
    const overlay = document.createElement('div');
    overlay.className = 'nx-an-overlay';
    overlay.id = 'nxAnOverlay';
    overlay.innerHTML = `
      <div class="nx-an-modal" role="dialog" aria-modal="true" aria-label="Analytics">
        <div class="nx-an-header">
          <div class="nx-an-title">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 13V8M6 13V5M10 13V9M14 13V3"/>
            </svg>
            Analytics
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <div class="nx-an-range" id="nxAnRange">
              <button class="nx-an-range-btn" data-range="today">Today</button>
              <button class="nx-an-range-btn active" data-range="7d">7 days</button>
              <button class="nx-an-range-btn" data-range="30d">30 days</button>
              <button class="nx-an-range-btn" data-range="all">All time</button>
            </div>
            <button class="icon-btn" id="nxAnClose" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 3l8 8M11 3l-8 8"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="nx-an-tabs">
          <button class="nx-an-tab active" data-tab="overview">Overview</button>
          <button class="nx-an-tab" data-tab="activity">Activity</button>
          <button class="nx-an-tab" data-tab="models">Models</button>
          <button class="nx-an-tab" data-tab="ratings">Ratings</button>
        </div>
        <div class="nx-an-body" id="nxAnBody"></div>
        <div class="nx-an-footer">
          <span id="nxAnFooterInfo">— events tracked</span>
          <div style="display:flex;gap:6px;">
            <button class="nx-an-footer-btn" id="nxAnExportCsv">Export CSV</button>
            <button class="nx-an-footer-btn danger" id="nxAnClear">Clear data</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    state.overlayEl = overlay;

    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#nxAnClose').addEventListener('click', close);
    overlay.querySelector('#nxAnExportCsv').addEventListener('click', exportCsv);
    overlay.querySelector('#nxAnClear').addEventListener('click', clearData);

    overlay.querySelectorAll('.nx-an-range-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.range = b.dataset.range;
        overlay.querySelectorAll('.nx-an-range-btn').forEach(x => {
          x.classList.toggle('active', x === b);
        });
        renderBody();
      });
    });
    overlay.querySelectorAll('.nx-an-tab').forEach(b => {
      b.addEventListener('click', () => {
        state.tab = b.dataset.tab;
        overlay.querySelectorAll('.nx-an-tab').forEach(x => {
          x.classList.toggle('active', x === b);
        });
        renderBody();
      });
    });

    renderBody();
  }

  function renderBody() {
    const body = state.overlayEl.querySelector('#nxAnBody');
    if (!body) return;
    const summary = getSummary(state.range);

    body.innerHTML = '';
    switch (state.tab) {
      case 'overview': return renderOverview(body, summary);
      case 'activity': return renderActivity(body, summary);
      case 'models': return renderModels(body, summary);
      case 'ratings': return renderRatings(body, summary);
    }
  }

  function renderOverview(body, s) {
    // Stats grid
    const grid = document.createElement('div');
    grid.className = 'nx-an-stats-grid';
    grid.innerHTML = `
      <div class="nx-an-stat">
        <div class="nx-an-stat-label">Prompts sent</div>
        <div class="nx-an-stat-value">${formatNum(s.sends)}</div>
        <div class="nx-an-stat-sub">${s.sends ? `${Math.round(s.sends / Math.max(1, daysInRange()) * 10) / 10}/day avg` : 'no activity'}</div>
      </div>
      <div class="nx-an-stat">
        <div class="nx-an-stat-label">Responses</div>
        <div class="nx-an-stat-value">${formatNum(s.okResponses)}</div>
        <div class="nx-an-stat-sub ${s.failedResponses ? 'down' : ''}">${s.failedResponses ? `${s.failedResponses} failed` : 'all successful'}</div>
      </div>
      <div class="nx-an-stat">
        <div class="nx-an-stat-label">Tokens used</div>
        <div class="nx-an-stat-value">${formatCompact(s.totalTokens)}</div>
        <div class="nx-an-stat-sub">${s.avgLatency ? `${(s.avgLatency / 1000).toFixed(1)}s avg latency` : 'no latency data'}</div>
      </div>
      <div class="nx-an-stat">
        <div class="nx-an-stat-label">Rating ratio</div>
        <div class="nx-an-stat-value">${s.ratings.total ? Math.round(s.ratings.up / s.ratings.total * 100) + '%' : '—'}</div>
        <div class="nx-an-stat-sub">${s.ratings.total ? `${s.ratings.up} up · ${s.ratings.down} down` : 'no ratings yet'}</div>
      </div>`;
    body.appendChild(grid);

    // Bar chart (per day)
    const chartSection = document.createElement('div');
    chartSection.className = 'nx-an-section';
    const dayEntries = Object.entries(s.perDay).sort((a, b) => a[0].localeCompare(b[0]));
    chartSection.innerHTML = `<div class="nx-an-section-title">Messages per day</div>`;
    if (!dayEntries.length) {
      chartSection.innerHTML += `<div class="nx-an-empty">No activity in this range.</div>`;
    } else {
      const maxSends = Math.max(...dayEntries.map(([, d]) => d.sends), 1);
      const barsEl = document.createElement('div');
      barsEl.className = 'nx-an-bars';
      for (const [day, d] of dayEntries) {
        const wrap = document.createElement('div');
        wrap.className = 'nx-an-bar-wrap';
        const h = Math.max(2, Math.round((d.sends / maxSends) * 100));
        wrap.innerHTML = `
          <div class="nx-an-bar" style="height:${h}%;">
            <div class="nx-an-bar-tooltip">${d.sends} sends · ${formatCompact(d.tokens)} tok</div>
          </div>
          <div class="nx-an-bar-label">${day.slice(5)}</div>`;
        barsEl.appendChild(wrap);
      }
      chartSection.appendChild(barsEl);
    }
    body.appendChild(chartSection);

    // Top models preview
    const modelSection = document.createElement('div');
    modelSection.className = 'nx-an-section';
    modelSection.innerHTML = `<div class="nx-an-section-title">Top models</div>`;
    const modelEntries = Object.entries(s.perModel)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    if (!modelEntries.length) {
      modelSection.innerHTML += `<div class="nx-an-empty">No model activity yet.</div>`;
    } else {
      const maxCount = modelEntries[0].count;
      const list = document.createElement('div');
      list.className = 'nx-an-model-list';
      modelEntries.forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'nx-an-model-row';
        row.innerHTML = `
          <div class="nx-an-model-rank ${i === 0 ? 'top' : ''}">${i + 1}</div>
          <div class="nx-an-model-body">
            <div class="nx-an-model-name">${escapeHtml(shortModelName(m.id))}</div>
            <div class="nx-an-model-meta">${m.count} sends · ${formatCompact(m.tokens)} tok</div>
          </div>
          <div class="nx-an-model-bar-wrap">
            <div class="nx-an-model-bar" style="width:${Math.round(m.count / maxCount * 100)}%"></div>
          </div>
          <div class="nx-an-model-count">${m.count}</div>`;
        list.appendChild(row);
      });
      modelSection.appendChild(list);
    }
    body.appendChild(modelSection);
  }

  function renderModels(body, s) {
    const entries = Object.entries(s.perModel)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.count - a.count);
    if (!entries.length) {
      body.innerHTML = `<div class="nx-an-empty">No model activity yet.</div>`;
      return;
    }
    const maxCount = entries[0].count;
    const list = document.createElement('div');
    list.className = 'nx-an-model-list';
    entries.forEach((m, i) => {
      const failPct = m.count ? Math.round(m.failed / m.count * 100) : 0;
      const row = document.createElement('div');
      row.className = 'nx-an-model-row';
      row.innerHTML = `
        <div class="nx-an-model-rank ${i === 0 ? 'top' : ''}">${i + 1}</div>
        <div class="nx-an-model-body">
          <div class="nx-an-model-name">${escapeHtml(shortModelName(m.id))}</div>
          <div class="nx-an-model-meta">
            ${m.count} uses · ${formatCompact(m.tokens)} tok${m.latency ? ` · ${(m.latency / Math.max(1, m.count) / 1000).toFixed(1)}s avg` : ''}${failPct ? ` · <span style="color:var(--danger)">${failPct}% failed</span>` : ''}
          </div>
        </div>
        <div class="nx-an-model-bar-wrap">
          <div class="nx-an-model-bar" style="width:${Math.round(m.count / maxCount * 100)}%"></div>
        </div>
        <div class="nx-an-model-count">${m.count}</div>`;
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  function renderRatings(body, s) {
    const { up, down, total } = s.ratings;
    body.innerHTML = `
      <div class="nx-an-stats-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="nx-an-stat">
          <div class="nx-an-stat-label">Positive</div>
          <div class="nx-an-stat-value" style="color:var(--success)">${up}</div>
        </div>
        <div class="nx-an-stat">
          <div class="nx-an-stat-label">Negative</div>
          <div class="nx-an-stat-value" style="color:var(--danger)">${down}</div>
        </div>
        <div class="nx-an-stat">
          <div class="nx-an-stat-label">Approval</div>
          <div class="nx-an-stat-value">${total ? Math.round(up / total * 100) + '%' : '—'}</div>
        </div>
      </div>`;
    if (total === 0) {
      body.innerHTML += `<div class="nx-an-empty">Rate some assistant responses to see stats here.<br><br>Look for 👍 / 👎 under each reply.</div>`;
    }
  }

  function renderActivity(body, s) {
    const start = rangeStart(state.range);
    const events = state.events
      .filter(e => e.ts >= start)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 200);
    if (!events.length) {
      body.innerHTML = `<div class="nx-an-empty">No activity in this range.</div>`;
      return;
    }
    const list = document.createElement('div');
    list.className = 'nx-an-log';
    for (const e of events) {
      const row = document.createElement('div');
      row.className = 'nx-an-log-row';
      const icon = e.t === 'send' ? '💬' : e.t === 'resp' ? (e.ok === false ? '❌' : '✨') : e.t === 'rate' ? (e.v === 1 ? '👍' : '👎') : '·';
      let detail = '';
      if (e.t === 'send') detail = 'Message sent';
      else if (e.t === 'resp') detail = `Response · ${e.tok || 0} tok${e.lat ? ` · ${(e.lat / 1000).toFixed(1)}s` : ''}`;
      else if (e.t === 'rate') detail = e.v === 1 ? 'Rated positive' : 'Rated negative';
      const model = e.m ? `<span class="nx-an-log-badge">${escapeHtml(shortModelName(e.m))}</span>` : '';
      row.innerHTML = `
        <span class="nx-an-log-time">${formatTime(e.ts)}</span>
        <span class="nx-an-log-icon">${icon}</span>
        <span class="nx-an-log-detail">${escapeHtml(detail)}</span>
        ${model}`;
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  function updateFooterInfo() {
    const el = state.overlayEl.querySelector('#nxAnFooterInfo');
    if (!el) return;
    el.textContent = `${state.events.length} events tracked locally · storage cap 5000`;
  }

  /* ============================================================
     CSV EXPORT
     ============================================================ */
  function exportCsv() {
    if (!state.events.length) {
      if (window.__nexus.showToast) window.__nexus.showToast('No data to export', 'warning', 2000);
      return;
    }
    const rows = [['timestamp', 'iso_time', 'type', 'chat_id', 'model', 'tokens', 'latency_ms', 'ok', 'vote']];
    for (const e of state.events) {
      rows.push([
        e.ts,
        new Date(e.ts).toISOString(),
        e.t,
        csvEscape(e.c || ''),
        csvEscape(e.m || ''),
        e.tok || '',
        e.lat || '',
        e.ok === false ? 'false' : (e.ok === true ? 'true' : ''),
        e.v || '',
      ]);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (window.__nexus.showToast) window.__nexus.showToast('CSV downloaded', 'success', 2000);
  }

  function clearData() {
    if (!confirm('Clear all analytics data? This cannot be undone.')) return;
    state.events = [];
    saveEvents();
    renderBody();
    updateFooterInfo();
    if (window.__nexus.showToast) window.__nexus.showToast('Analytics cleared', 'success', 2000);
  }

  /* ============================================================
     HOOKS
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    loadEvents();
    mountButton();

    if (!window.__nexus.hooks) return;

    // Track sends
    if (Array.isArray(window.__nexus.hooks.beforeMessageSend)) {
      window.__nexus.hooks.beforeMessageSend.push((chat) => {
        track('send', {
          c: chat?.id,
          m: window.__nexus.state.activeModel?.id,
        });
      });
    }

    // Track responses after each send
    if (Array.isArray(window.__nexus.hooks.afterMessageSend)) {
      window.__nexus.hooks.afterMessageSend.push((chat) => {
        const last = chat?.messages?.[chat.messages.length - 1];
        if (!last || last.role !== 'assistant') return;
        track('resp', {
          c: chat.id,
          m: last.model || window.__nexus.state.activeModel?.id,
          tok: last.usage?.total_tokens || 0,
          lat: last._latency || 0,
          ok: !last.error,
        });
      });
    }

    // Track rating clicks
    if (Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg, index, chat) => {
        // Only wire once per message element instance
        if (wrapper.dataset.nxAnWired) return;
        wrapper.dataset.nxAnWired = '1';
        // Attach listener to rating buttons if they exist
        const rateBtns = wrapper.querySelectorAll('.nx-rating-btn');
        rateBtns.forEach((btn, i) => {
          btn.addEventListener('click', () => {
            // Determine vote (up=0, down=1)
            const vote = i === 0 ? 1 : -1;
            track('rate', {
              c: chat?.id,
              m: msg.model || window.__nexus.state.activeModel?.id,
              v: vote,
            });
          });
        });
      });
    }
  });

  /* ============================================================
     MOUNT BUTTON
     ============================================================ */
  function mountButton() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar || document.getElementById('nxAnBtn')) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxAnBtn';
    btn.title = 'Analytics dashboard';
    btn.setAttribute('aria-label', 'Analytics');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 13V8M6 13V5M10 13V9M14 13V3"/>
      </svg>`;
    btn.addEventListener('click', open);
    topBar.insertBefore(btn, topBar.firstChild);
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function open() {
    buildModal();
    renderBody();
    updateFooterInfo();
    state.overlayEl.classList.add('open');
  }
  function close() {
    if (state.overlayEl) state.overlayEl.classList.remove('open');
  }

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function formatNum(n) {
    return Number(n || 0).toLocaleString('en-US');
  }
  function formatCompact(n) {
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return (n / 1e6).toFixed(2) + 'M';
  }
  function formatTime(ts) {
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return 'Today ' + d.toTimeString().slice(0, 5);
    return d.toLocaleDateString() + ' ' + d.toTimeString().slice(0, 5);
  }
  function shortModelName(id) {
    if (!id) return 'unknown';
    return String(id).split('/').pop();
  }
  function csvEscape(s) {
    const str = s == null ? '' : String(s);
    if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }
  function daysInRange() {
    switch (state.range) {
      case 'today': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case 'all': return Math.max(1, Math.ceil((Date.now() - (state.events[0]?.ts || Date.now())) / 864e5));
      default: return 7;
    }
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Analytics = {
    open, close,
    track,
    getSummary,
    exportCsv,
  };
})();
