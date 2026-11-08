// AURORA OS — Analytics

import { h, $, clear, fmtNum, fmtPct, debounce } from '../core/dom.js';
import { store } from '../core/store.js';
import { makeTimeseries, KPI_DATA, TRANSACTIONS } from '../data/seed.js';
import { segmented, card, badge, button } from '../ui/components.js';
import { lineChart, barChart, donutChart, heatmap, radialGauge, areaChart, sparkline, scatterPlot } from '../ui/charts.js';

export const meta = {
  id: 'analytics',
  title: 'Analytics',
  icon: '◑',
  defaultSize: { width: 1000, height: 640 },
};

let _range = '30d';
let _root = null;

const RANGES = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

function rangeLabel() {
  return RANGES[_range] + ' days';
}

function panel(title, body) {
  const c = h('div', { class: 'an-panel' });
  c.append(h('div', { class: 'an-panel__head' }, [h('div', { class: 'an-panel__title', text: title })]));
  c.append(h('div', { class: 'an-panel__body' }, [body]));
  return c;
}

function buildTopKPIs() {
  const grid = h('div', { class: 'an-kpis' });
  const days = RANGES[_range];
  for (const k of KPI_DATA) {
    const delta = ((Math.random() - 0.5) * 30).toFixed(1);
    const dCls = delta >= 0 ? 'kpi-delta--up' : 'kpi-delta--down';
    const card = h('div', { class: 'an-kpi' });
    card.append(h('div', { class: 'an-kpi__label', text: k.label }));
    card.append(h('div', { class: 'an-kpi__value', text: k.value }));
    const del = h('div', { class: 'kpi-delta ' + dCls });
    del.append(h('span', { text: (delta >= 0 ? '↑ ' : '↓ ') + Math.abs(delta) + '%' }));
    card.append(del);
    card.append(sparkline(makeTimeseries(days, 100, 15), { width: 200, height: 40 }));
    grid.append(card);
  }
  return grid;
}

function buildMainChart() {
  const days = RANGES[_range];
  const labels = Array.from({ length: days }, (_, i) => 'D' + (i + 1));
  const series = [
    { name: 'Sessions', data: makeTimeseries(days, 200, 40), color: 'var(--accent)' },
    { name: 'Signups', data: makeTimeseries(days, 60, 15), color: 'var(--accent-2)' },
    { name: 'Revenue', data: makeTimeseries(days, 100, 20), color: 'var(--success)' },
  ];
  return areaChart(series, { width: 640, height: 280, xLabels: labels });
}

function buildBarChart() {
  const data = [
    { label: 'Mon', value: 142 }, { label: 'Tue', value: 218 },
    { label: 'Wed', value: 178 }, { label: 'Thu', value: 262 },
    { label: 'Fri', value: 301 }, { label: 'Sat', value: 198 },
    { label: 'Sun', value: 164 },
  ];
  return barChart(data, { width: 320, height: 220, color: 'var(--accent-2)' });
}

function buildDonut() {
  const data = [
    { label: 'Web', value: 6400, color: 'var(--accent)' },
    { label: 'iOS', value: 3200, color: 'var(--accent-2)' },
    { label: 'Android', value: 2400, color: 'var(--success)' },
    { label: 'Desktop', value: 1200, color: 'var(--warning)' },
  ];
  return donutChart(data, { size: 180, centerValue: '13.2K', centerLabel: 'sessions' });
}

function buildHeatmap() {
  const days = 28;
  const data = Array.from({ length: days }, (_, i) => ({ label: 'D' + (i + 1), value: Math.floor(Math.random() * 100) }));
  return heatmap(data, { cols: 7, cellSize: 20, gap: 3 });
}

function buildGauges() {
  const wrap = h('div', { class: 'an-gauges' });
  wrap.append(radialGauge(72, { label: 'SLA', size: 100 }));
  wrap.append(radialGauge(58, { label: 'NPS', size: 100, color: 'var(--accent-2)' }));
  wrap.append(radialGauge(91, { label: 'Uptime', size: 100, color: 'var(--success)' }));
  wrap.append(radialGauge(42, { label: 'Churn', size: 100, color: 'var(--warning)' }));
  return wrap;
}

function buildScatter() {
  const points = Array.from({ length: 30 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    color: Math.random() > 0.5 ? 'var(--accent)' : 'var(--accent-2)',
  }));
  return scatterPlot(points, { width: 320, height: 220 });
}

function buildTable() {
  const table = h('table', { class: 'table' });
  const thead = h('thead', {}, [h('tr', {}, [
    h('th', { text: 'Region' }), h('th', { text: 'Sessions' }), h('th', { text: 'Revenue' }), h('th', { text: 'Conv.' }),
  ])]);
  const tbody = h('tbody', {});
  const regions = ['US-East', 'US-West', 'EU-West', 'AP-South', 'AP-East'];
  for (const r of regions) {
    const tr = h('tr');
    tr.append(h('td', { text: r }));
    tr.append(h('td', { text: fmtNum(Math.floor(Math.random() * 50000)) }));
    tr.append(h('td', { text: '$' + (Math.random() * 100000).toFixed(0) }));
    tr.append(h('td', { text: (Math.random() * 8).toFixed(2) + '%' }));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  return table;
}

function render() {
  if (!_root) return;
  clear(_root);

  const header = h('div', { class: 'an-header' });
  header.append(h('div', { class: 'an-title', text: 'Analytics' }));
  const rangeSwitch = segmented([
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' },
    { value: '1y', label: '1y' },
  ], { active: _range, onChange: (v) => { _range = v; render(); } });
  header.append(rangeSwitch);
  _root.append(header);

  _root.append(buildTopKPIs());

  const grid = h('div', { class: 'an-grid' });
  grid.append(panel('Traffic & revenue', buildMainChart()));
  grid.append(panel('Weekly volume', buildBarChart()));
  grid.append(panel('Devices', buildDonut()));
  grid.append(panel('Engagement heatmap', buildHeatmap()));
  grid.append(panel('Health gauges', buildGauges()));
  grid.append(panel('Cohort scatter', buildScatter()));
  grid.append(panel('Regional breakdown', buildTable()));
  _root.append(grid);
}

export function mount(container) {
  clear(container);
  _root = h('div', { class: 'an-wrap' });
  container.append(_root);
  render();
}

export default { meta, mount };
