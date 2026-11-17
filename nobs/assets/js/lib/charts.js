/* ==========================================================================
   charts.js — نمودارهای SVG/HTML بدون کتابخانه
   ========================================================================== */

import { esc, faNum, fmtInt, pct, uid, clamp } from './utils.js';

/** دونات با مرکز قابل تنظیم */
export function donutChart({
  items = [],
  size = 168,
  thickness = 18,
  centerValue = '',
  centerLabel = '',
  showLegend = true,
  legendMode = 'value',
} = {}) {
  const total = items.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = items
    .filter((item) => Number(item.value) > 0)
    .map((item) => {
      const length = total ? (Number(item.value) / total) * circumference : 0;
      const dash = `<circle class="donut__seg" cx="${size / 2}" cy="${size / 2}" r="${radius}"
        fill="none" stroke="${item.color || 'var(--acc)'}" stroke-width="${thickness}"
        stroke-dasharray="${length} ${circumference - length}"
        stroke-dashoffset="${-offset}" stroke-linecap="butt"
        transform="rotate(-90 ${size / 2} ${size / 2})"></circle>`;
      offset += length;
      return dash;
    })
    .join('');

  const legend = showLegend
    ? `<div class="donut-legend">
        ${items
          .map((item) => {
            const share = pct(item.value, total, 0);
            return `<div class="donut-legend__row">
              <span class="donut-legend__dot" style="background:${item.color || 'var(--acc)'}"></span>
              <span>${esc(item.label)}${legendMode === 'percent' ? `<span class="donut-legend__pct">${faNum(share)}٪</span>` : ''}</span>
              <span class="donut-legend__val">${fmtInt(item.value)}</span>
            </div>`;
          })
          .join('')}
      </div>`
    : '';

  return `
    <div class="chart__body">
      <div class="donut" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="نمودار سهم امتیازها">
          <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${thickness}"></circle>
          ${segments}
        </svg>
        <div class="donut__center">
          <span class="donut__value">${centerValue}</span>
          <span class="donut__label">${esc(centerLabel)}</span>
        </div>
      </div>
      ${legend}
    </div>
  `;
}

/** فهرست میله‌های افقی */
export function barList({ items = [], tone = '', emptyText = 'داده‌ای نیست', showValue = true } = {}) {
  if (!items.length) {
    return `<p class="u-xs u-dim" style="padding:12px 0">${esc(emptyText)}</p>`;
  }
  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  return `
    <div class="barlist">
      ${items
        .map((item) => {
          const width = clamp(((Number(item.value) || 0) / max) * 100, 1, 100);
          const toneClass = item.tone ?? tone;
          return `<div class="bar-row">
            <div class="bar-row__top">
              <span class="bar-row__name">${esc(item.label)}</span>
              ${item.sub ? `<span class="u-faint" style="font-size:9.5px">${esc(item.sub)}</span>` : ''}
              ${showValue ? `<span class="bar-row__val">${esc(item.display ?? fmtInt(item.value))}</span>` : ''}
            </div>
            <div class="bar-row__track">
              <i class="bar-row__fill ${toneClass ? `bar-row__fill--${toneClass}` : ''}" style="width:${width}%;${item.color ? `background:${item.color};` : ''}"></i>
            </div>
          </div>`;
        })
        .join('')}
    </div>
  `;
}

/** اسپارک‌لاین */
export function sparkline({ values = [], width = 280, height = 64, tone = '', color = '' } = {}) {
  const nums = values.map((v) => Number(v) || 0);
  if (nums.length < 2) {
    return `<div class="u-center u-faint u-xs" style="height:${height}px">داده کافی نیست</div>`;
  }
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const stepX = width / (nums.length - 1);
  const points = nums.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const gradId = uid('spark');
  const strokeColor = color || (tone === 'violet' ? '#a685ff' : 'var(--acc)');

  return `
    <svg class="spark ${tone ? `spark--${tone}` : ''}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="روند">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.35"></stop>
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gradId})"></path>
      <path d="${line}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="${points[points.length - 1][0].toFixed(1)}" cy="${points[points.length - 1][1].toFixed(1)}" r="2.6" fill="${strokeColor}"></circle>
    </svg>
  `;
}

/** رینگ درصدی */
export function ring({ value = 0, size = 64, thickness = 6, color = 'var(--acc)', label = '' } = {}) {
  const p = clamp(Number(value) || 0, 0, 100);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (p / 100) * circumference;
  return `
    <div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label || `${Math.round(p)} درصد`)}">
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${thickness}"></circle>
        <circle class="ring__bar" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="${color}" stroke-width="${thickness}"
          stroke-dasharray="${dash} ${circumference - dash}"
          transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
      </svg>
      <div class="progress-ring__value" style="font-size:${size / 4}px">${faNum(Math.round(p))}<small style="font-size:9px;color:var(--txt-4)">٪</small></div>
    </div>
  `;
}

/** خلاصه امتیاز به‌صورت سه ردیف سهم */
export function ratingBreakdown(rows) {
  const total = rows.reduce((acc, row) => acc + Number(row.value || 0), 0);
  return `
    <div class="stack stack--sm">
      ${rows
        .map((row) => {
          const share = pct(row.value, total, 0);
          return `<div class="legend-row">
            <span class="u-row u-gap-1" style="font-size:10px"><span class="vendor-dot" style="background:${row.color}"></span>${esc(row.label)}</span>
            <span class="legend-row__bar"><i style="width:${share}%;background:${row.color}"></i></span>
            <span class="legend-row__val">${fmtInt(row.value)}</span>
          </div>`;
        })
        .join('')}
    </div>
  `;
}

/** نقشه حرارتی ۱۲ ماهه */
export function heatmap({ cells = [], max = 0, unit = 'خرید' } = {}) {
  const top = max || Math.max(...cells.map((c) => Number(c.value) || 0), 1);
  return `
    <div>
      <div class="heat-grid">
        ${cells
          .map((cell) => {
            const ratio = (Number(cell.value) || 0) / top;
            const alpha = ratio === 0 ? 0 : 0.18 + ratio * 0.72;
            const title = cell.meta || `${cell.label}: ${fmtInt(cell.value)} ${unit}`;
            return `<div class="heat-cell" title="${esc(title)}" style="${ratio ? `border-color: rgba(53,224,161,.28)` : ''}">
              <span class="heat-cell__fill" style="opacity:${alpha}"></span>
              <span>${faNum(cell.label)}</span>
            </div>`;
          })
          .join('')}
      </div>
      <div class="heat-months">
        ${cells.map((cell) => `<span>${esc(cell.monthLabel || '')}</span>`).join('')}
      </div>
    </div>
  `;
}

export function vendorPerfRow({ name, color, emoji, reviews, avg, health }) {
  return `
    <div class="vp-row">
      <span class="avatar avatar--sm" style="--hue:${color ? 0 : 158}">
        <span class="avatar__emoji">${esc(emoji || '🛒')}</span>
      </span>
      <div class="u-grow" style="min-width:0">
        <div class="vp-row__name u-truncate">${esc(name)}</div>
        <div class="vp-row__meta">${fmtInt(reviews)} تجربه · سلامت ${faNum(health)}٪</div>
      </div>
      <div class="vp-row__score">
        <b class="u-num">${faNum(avg.toFixed(1))}</b>
        <span>از ۳</span>
      </div>
    </div>
  `;
}
