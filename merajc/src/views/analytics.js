/** Analytics: recorded provider usage, model performance, routing choices, and raw errors. */
import { CONFIG } from '../config.js';
import { state } from '../store.js';
import * as db from '../services/db.js';
import {
  buildAnalytics,
  analyticsKpis,
  eventToCsvRow,
} from '../services/analytics.js';
import { usageChart, donutChart, latencyBars, chartEmpty, distributionBars, sparkline } from '../ui/charts.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { reportError, openErrorDialog } from '../ui/errorDialog.js';
import { eventsToCsv } from '../services/export.js';
import {
  download,
  escapeHtml,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTokens,
  relativeTime,
  providerFromSlug,
  prettyModelName,
} from '../utils.js';

let rootEl = null;
let ctx = null;
let allEvents = [];
let loading = false;
let error = null;
let days = 30;
let modelFilter = 'all';
let metric = 'tokens';

const RANGES = [
  [7, '7 days'],
  [30, '30 days'],
  [90, '90 days'],
  ['all', 'All time'],
];

function kpiCard(kpi) {
  return `<div class="kpi-card">
    <span class="kpi-card__icon">${icon(kpi.icon, { size: 18 })}</span>
    <div><p>${escapeHtml(kpi.label)}</p><strong>${escapeHtml(kpi.value)}</strong><span>${escapeHtml(kpi.sub)}</span></div>
  </div>`;
}

function modelTable(analytics) {
  if (!analytics.models.length) return chartEmpty('No model has answered a request in this range.');
  const maxRequests = Math.max(...analytics.models.map((row) => row.requests), 1);
  return `<div class="data-table-wrap">
    <table class="data-table analytics-table">
      <thead><tr><th>Model</th><th class="num">Requests</th><th class="num">Tokens</th><th class="num">Avg latency</th><th>Success</th><th class="num">Last used</th></tr></thead>
      <tbody>
        ${analytics.models
          .map(
            (row) => `<tr>
              <td>
                <div class="model-cell">
                  <span class="model-orb model-orb--small" style="--hue:${row.slug === 'openrouter/free' ? 42 : 182}">${row.slug === 'openrouter/free' ? icon('spark', { size: 13 }) : escapeHtml((row.provider || 'M').slice(0, 1))}</span>
                  <div><strong>${escapeHtml(row.name)}</strong><code>${escapeHtml(row.slug)}</code></div>
                </div>
              </td>
              <td class="num"><span class="table-bar"><i style="width:${(row.requests / maxRequests) * 100}%"></i></span><strong>${formatNumber(row.requests)}</strong></td>
              <td class="num mono">${formatTokens(row.tokens)}</td>
              <td class="num mono">${row.avgLatency ? formatDuration(row.avgLatency) : '—'}</td>
              <td><div class="success-cell"><span class="success-track"><i style="width:${row.successRate || 0}%;background:${row.successRate >= 80 ? 'var(--jade)' : row.successRate >= 50 ? 'var(--amber)' : 'var(--rose)'}"></i></span><span>${row.successRate === null ? '—' : `${row.successRate.toFixed(0)}%`}</span></div></td>
              <td class="num muted">${row.lastUsed ? relativeTime(row.lastUsed) : '—'}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>`;
}

function routerCard(analytics) {
  if (!analytics.routerChoices.length) {
    return `<section class="analysis-card">
      <div class="analysis-card__head"><div><p class="eyebrow">Router provenance</p><h2>Where OpenRouter sent you</h2></div></div>
      <div class="analysis-empty">${icon('split', { size: 24 })}<p>No <code>openrouter/free</code> request has completed yet. When it does, the exact model chosen by the router appears here.</p></div>
    </section>`;
  }
  const total = analytics.routerChoices.reduce((sum, row) => sum + row.count, 0);
  return `<section class="analysis-card">
    <div class="analysis-card__head"><div><p class="eyebrow">Router provenance</p><h2>Where OpenRouter sent you</h2><p>${formatNumber(total)} auto-routed request(s), grouped by the actual answering model.</p></div></div>
    <div class="router-list">
      ${analytics.routerChoices.map((row, index) => `<div class="router-list__row">
        <span class="route-rank">${String(index + 1).padStart(2, '0')}</span>
        <div class="router-list__copy"><strong>${escapeHtml(row.name)}</strong><code>${escapeHtml(row.slug)}</code></div>
        <div class="router-list__bar"><span style="width:${(row.count / total) * 100}%"></span></div>
        <strong class="mono">${formatNumber(row.count)}</strong>
      </div>`).join('')}
    </div>
  </section>`;
}

function statusCard(analytics) {
  const segments = [
    { label: 'Succeeded', value: analytics.byStatus.ok, color: 'var(--jade)' },
    { label: 'Failed', value: analytics.byStatus.error, color: 'var(--rose)' },
    { label: 'Stopped by you', value: analytics.byStatus.aborted, color: 'var(--amber)' },
  ];
  return `<section class="analysis-card analysis-card--donut">
    <div class="analysis-card__head"><div><p class="eyebrow">Reliability</p><h2>Request outcomes</h2></div></div>
    ${donutChart(segments, {
      centerValue: analytics.totals.requests ? `${(analytics.totals.successRate || 0).toFixed(0)}%` : '—',
      centerLabel: 'success',
    })}
    <div class="mini-facts">
      <div><span>Error rate</span><strong>${analytics.totals.errorRate === null ? '—' : `${analytics.totals.errorRate.toFixed(1)}%`}</strong></div>
      <div><span>Auto-routed</span><strong>${formatNumber(analytics.totals.autoRouted)}</strong></div>
      <div><span>Avg tokens/request</span><strong>${formatTokens(analytics.totals.avgTokens)}</strong></div>
    </div>
    ${distributionBars(segments)}
  </section>`;
}

function errorsCard(analytics) {
  return `<section class="analysis-card">
    <div class="analysis-card__head"><div><p class="eyebrow">Failure ledger</p><h2>Errors exactly as recorded</h2><p>Provider error codes and messages are stored verbatim in the event row.</p></div><span class="tag ${analytics.errors.length ? 'tag--danger' : 'tag--ok'}">${analytics.errors.length} group(s)</span></div>
    ${analytics.errors.length
      ? `<div class="error-ledger">
          ${analytics.errors
            .slice(0, 8)
            .map(
              (row) => `<div class="error-ledger__row">
                <span class="error-ledger__count">${formatNumber(row.count)}×</span>
                <div><div class="error-ledger__head"><code>${escapeHtml(row.code || 'unclassified')}</code>${row.httpStatus ? `<span class="mono">HTTP ${escapeHtml(row.httpStatus)}</span>` : ''}<span class="muted">${escapeHtml(row.model || '')}</span></div><p>${escapeHtml(row.message || 'No message recorded.')}</p></div>
                <span class="muted tiny">${row.last ? relativeTime(row.last) : ''}</span>
              </div>`,
            )
            .join('')}
        </div>`
      : `<div class="analysis-empty">${icon('checkCircle', { size: 24 })}<p>No errors recorded in this range.</p></div>`}
  </section>`;
}

function recentCard(analytics) {
  return `<section class="analysis-card">
    <div class="analysis-card__head"><div><p class="eyebrow">Trail</p><h2>Recent requests</h2></div></div>
    ${analytics.recent.length
      ? `<div class="recent-list">
          ${analytics.recent
            .map(
              (event) => `<div class="recent-row">
                <span class="recent-row__dot recent-row__dot--${event.status}"></span>
                <div><strong>${escapeHtml(event.model_slug || 'unknown model')}</strong><p>${event.requested_model === 'openrouter/free' ? 'via router' : 'direct'} · ${formatTokens(event.total_tokens || 0)} tokens · ${event.latency_ms ? formatDuration(event.latency_ms) : 'latency unknown'}</p></div>
                <span class="muted tiny">${relativeTime(event.created_at)}</span>
              </div>`,
            )
            .join('')}
        </div>`
      : `<div class="analysis-empty">${icon('clock', { size: 22 })}<p>No requests yet.</p></div>`}
  </section>`;
}

function render() {
  if (!rootEl) return;
  if (loading && !allEvents.length) {
    rootEl.innerHTML = `<div class="page-loading"><span class="boot-spinner"></span><p>Aggregating recorded usage…</p></div>`;
    return;
  }
  const analytics = buildAnalytics(allEvents, state.models, { days, model: modelFilter });
  const kpis = analyticsKpis(analytics);
  const modelOptions = Array.from(new Set(allEvents.flatMap((event) => [event.model_slug, event.requested_model]).filter(Boolean))).sort();
  const requestSpark = analytics.series.map((bucket) => bucket.requests);
  const peakLabel = analytics.peak ? `${analytics.peak.label} · ${formatTokens(analytics.peak.tokens)}` : 'no activity';

  rootEl.innerHTML = `<div class="page analytics-page">
    <header class="page-head">
      <button type="button" class="icon-btn page-menu" data-open-sidebar aria-label="Open conversations">${icon('menu', { size: 19 })}</button>
      <div class="page-head__copy">
        <p class="eyebrow"><span class="eyebrow__line"></span> Evidence over vibes</p>
        <h1>Model analytics</h1>
        <p>Tokens, latency, success, routing, and failure — aggregated from every outbound completion attempt your account has recorded.</p>
      </div>
      <div class="page-head__actions">
        <button type="button" class="btn btn--ghost" data-reload ${loading ? 'disabled' : ''}>${icon(loading ? 'loader' : 'refresh', { size: 15, className: loading ? 'spin' : '' })}<span>Refresh</span></button>
        <button type="button" class="btn btn--primary" data-export-analytics>${icon('download', { size: 15 })}<span>Export CSV</span></button>
      </div>
    </header>

    ${error ? `<div class="panel-error">${renderErrorPanel(error)}</div>` : ''}

    <div class="analytics-toolbar">
      <div class="segmented">${RANGES.map(([value, label]) => `<button type="button" class="segmented__item ${days === value ? 'is-active' : ''}" data-range="${value}">${label}</button>`).join('')}</div>
      <div class="analytics-toolbar__right">
        <label class="field-inline"><span>Model</span><select class="input input--select" id="analytics-model"><option value="all">All models</option>${modelOptions.map((slug) => `<option value="${escapeHtml(slug)}" ${modelFilter === slug ? 'selected' : ''}>${escapeHtml(slug)}</option>`).join('')}</select></label>
        <span class="muted tiny">${formatNumber(analytics.events.length)} events in view</span>
      </div>
    </div>

    ${analytics.totals.requests === 0 ? `<section class="analytics-empty">
      ${icon('chart', { size: 36 })}
      <h2>No requests recorded here yet.</h2>
      <p>Send a message in a conversation. Provider usage, latency, and model provenance will appear here. The numbers come from OpenRouter's <code>usage</code> fields whenever they are returned.</p>
      <a class="btn btn--primary" href="#/chat">${icon('arrowRight', { size: 16 })}<span>Open a conversation</span></a>
    </section>` : `
      <div class="kpi-grid">${kpis.map(kpiCard).join('')}</div>

      <section class="analysis-card analysis-card--chart">
        <div class="analysis-card__head">
          <div><p class="eyebrow">Throughput</p><h2>Usage over time</h2><p>Peak: ${escapeHtml(peakLabel)} · ${formatNumber(analytics.totals.requests)} requests in range</p></div>
          <div class="segmented segmented--small">
            <button type="button" class="segmented__item ${metric === 'tokens' ? 'is-active' : ''}" data-metric="tokens">Tokens</button>
            <button type="button" class="segmented__item ${metric === 'requests' ? 'is-active' : ''}" data-metric="requests">Requests</button>
          </div>
        </div>
        ${usageChart(analytics.series, { metric, height: 270 })}
        <div class="chart-foot"><span>${sparkline(requestSpark, { width: 120, height: 30 })}</span><span>${formatNumber(analytics.totals.promptTokens)} prompt · ${formatNumber(analytics.totals.completionTokens)} completion</span></div>
      </section>

      <div class="analysis-grid">
        ${statusCard(analytics)}
        <section class="analysis-card">
          <div class="analysis-card__head"><div><p class="eyebrow">Speed</p><h2>Latency by model</h2><p>Average provider round-trip for successful calls.</p></div></div>
          ${latencyBars(analytics.models)}
          <div class="mini-facts mini-facts--two">
            <div><span>Overall average</span><strong>${analytics.totals.avgLatency ? formatDuration(analytics.totals.avgLatency) : '—'}</strong></div>
            <div><span>Active models</span><strong>${formatNumber(analytics.totals.activeModels)}</strong></div>
          </div>
        </section>
      </div>

      <section class="analysis-card">
        <div class="analysis-card__head"><div><p class="eyebrow">Leaderboard</p><h2>Per-model performance</h2><p>Requests are grouped by the actual answering model, not the requested slug.</p></div></div>
        ${modelTable(analytics)}
      </section>

      <div class="analysis-grid">
        ${routerCard(analytics)}
        ${errorsCard(analytics)}
      </div>
      ${recentCard(analytics)}
    `}

    <p class="page-footnote">${icon('info', { size: 14 })} Token numbers are provider-reported when OpenRouter returns <code>usage</code>; otherwise the event recorded 0 and the message itself carries a clearly labelled local estimate. Analytics events are per request, including failed and stopped attempts. Free-model latency varies by load.</p>
  </div>`;

  bind();
}

function renderErrorPanel(rawError) {
  return `<div class="inline-error">
    <div class="inline-error__head">${icon('alert', { size: 17 })}<strong>Analytics could not load</strong><button type="button" class="link-btn" data-error-details>Raw details</button></div>
    <p>${escapeHtml(rawError.message || 'No message returned.')}</p>
    <details><summary>Exact Supabase error</summary><pre>${escapeHtml(JSON.stringify(rawError, null, 2))}</pre></details>
  </div>`;
}

function bind() {
  rootEl.querySelector('[data-open-sidebar]')?.addEventListener('click', () => ctx?.openSidebar?.());
  rootEl.querySelector('[data-reload]')?.addEventListener('click', () => load());
  rootEl.querySelector('[data-export-analytics]')?.addEventListener('click', exportCsv);
  rootEl.querySelector('[data-error-details]')?.addEventListener('click', () => openErrorDialog('Analytics query error', error));
  rootEl.querySelectorAll('[data-range]').forEach((button) => {
    button.addEventListener('click', () => {
      days = button.dataset.range === 'all' ? 'all' : Number(button.dataset.range);
      render();
    });
  });
  rootEl.querySelectorAll('[data-metric]').forEach((button) => {
    button.addEventListener('click', () => {
      metric = button.dataset.metric;
      render();
    });
  });
  rootEl.querySelector('#analytics-model')?.addEventListener('change', (event) => {
    modelFilter = event.target.value;
    render();
  });
}

function exportCsv() {
  const analytics = buildAnalytics(allEvents, state.models, { days, model: modelFilter });
  if (!analytics.events.length) {
    toast({ title: 'Nothing to export', message: 'No events match the current filters.', type: 'info' });
    return;
  }
  const csv = eventsToCsv(analytics.events);
  download(`meraj-analytics-${days}-days.csv`, csv, 'text/csv;charset=utf-8');
  toast({ title: 'Analytics exported', message: `${analytics.events.length} event rows.`, type: 'success' });
}

async function load(showToast = false) {
  loading = true;
  if (!allEvents.length) render();
  else {
    const button = rootEl?.querySelector('[data-reload]');
    if (button) button.disabled = true;
  }
  const { data, error: loadError } = await db.listEvents({ limit: CONFIG.limits.events });
  loading = false;
  if (loadError) {
    error = loadError;
    reportError('Could not load analytics events', loadError);
  } else {
    error = null;
    allEvents = data || [];
    if (showToast) toast({ title: 'Analytics refreshed', message: `${formatNumber(allEvents.length)} events.`, type: 'success' });
  }
  render();
}

export async function mountAnalytics(root, context = {}) {
  rootEl = root;
  ctx = context;
  days = 30;
  modelFilter = 'all';
  metric = 'tokens';
  error = null;
  allEvents = [];
  await load();
}

export function unmountAnalytics() {
  rootEl = null;
  ctx = null;
  allEvents = [];
}

void eventToCsvRow;
void formatDateTime;
void providerFromSlug;
void prettyModelName;
