/* ============================================================
   Charts — pure SVG / DOM chart helpers
   No external deps. All return HTML strings for innerHTML.
   ============================================================ */
import { escapeHtml, formatNumber } from '../utils.js';

/* ---------- horizontal bar chart ---------- */
export function hBarChart(items, { max, emptyText = 'داده‌ای نیست' } = {}) {
  if (!items || !items.length) {
    return `<div class="chart-empty">${escapeHtml(emptyText)}</div>`;
  }
  const maxVal = Math.max(1, ...(max != null ? [max] : items.map((i) => i.value)));
  return `<div class="chart-hbar">${items
    .map((item) => {
      const pct = Math.max(2, (item.value / maxVal) * 100);
      const color = item.color || 'var(--brand)';
      return `
        <div class="chart-hbar__row">
          <div class="chart-hbar__label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
          <div class="chart-hbar__track">
            <div class="chart-hbar__fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="chart-hbar__value">${formatNumber(item.value)}</div>
        </div>`;
    })
    .join('')}</div>`;
}

/* ---------- vertical bar chart (timeline) ---------- */
export function vBarChart(items, { height = 180, emptyText = 'داده‌ای نیست' } = {}) {
  if (!items || !items.length) {
    return `<div class="chart-empty">${escapeHtml(emptyText)}</div>`;
  }
  const maxVal = Math.max(1, ...items.map((i) => i.value));
  return `<div class="chart-vbars" style="height:${height}px">${items
    .map((item) => {
      const h = Math.max(4, (item.value / maxVal) * 100);
      const color = item.color || 'var(--brand-grad)';
      return `
        <div class="chart-vbar">
          <div class="chart-vbar__value">${item.value > 0 ? formatNumber(item.value) : ''}</div>
          <div class="chart-vbar__track">
            <div class="chart-vbar__fill" style="height:${h}%;background:${color}"></div>
          </div>
          <div class="chart-vbar__label">${escapeHtml(item.label)}</div>
        </div>`;
    })
    .join('')}</div>`;
}

/* ---------- donut chart ---------- */
export function donutChart(items, { size = 180, emptyText = 'داده‌ای نیست' } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return `<div class="chart-empty">${escapeHtml(emptyText)}</div>`;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const innerR = r * 0.6;
  let acc = 0;

  const segments = items
    .map((item) => {
      const frac = item.value / total;
      const start = acc * Math.PI * 2 - Math.PI / 2;
      const end = (acc + frac) * Math.PI * 2 - Math.PI / 2;
      acc += frac;

      // If only one item, draw a full circle
      if (items.length === 1) {
        return `<circle cx="${cx}" cy="${cy}" r="${(r + innerR) / 2}" fill="none"
          stroke="${item.color}" stroke-width="${r - innerR}" />`;
      }

      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const ix1 = cx + innerR * Math.cos(end);
      const iy1 = cy + innerR * Math.sin(end);
      const ix2 = cx + innerR * Math.cos(start);
      const iy2 = cy + innerR * Math.sin(start);

      const d = [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2}`,
        'Z',
      ].join(' ');

      return `<path d="${d}" fill="${item.color}" />`;
    })
    .join('');

  const legend = items
    .map(
      (item) => `
      <div class="donut-legend__item">
        <span class="donut-legend__dot" style="background:${item.color}"></span>
        <span class="donut-legend__label">${escapeHtml(item.label)}</span>
        <span class="donut-legend__value">${formatNumber(item.value)}</span>
      </div>`
    )
    .join('');

  return `
    <div class="donut-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut-svg">${segments}</svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

/* ---------- color palette for charts ---------- */
export const CHART_COLORS = [
  '#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#6366f1', '#f97316', '#14b8a6', '#a3e635',
];
export function pickColor(i) {
  return CHART_COLORS[i % CHART_COLORS.length];
}
