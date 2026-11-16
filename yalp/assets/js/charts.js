/**
 * بازاربان — نمودارهای SVG سبک
 * ---------------------------------------------------------------------------
 * بدون کتابخانه: همهٔ نمودارها SVG یا CSS خالص‌اند و از توکن‌های رنگ پیروی
 * می‌کنند. خروجی رشتهٔ HTML است و در قالب کارت‌ها درج می‌شود.
 */

import { esc, fmtInt, toFa, clamp } from './utils.js';

const uid = () => `g${Math.random().toString(36).slice(2, 8)}`;

/* --------------------------------------------------------------------------
   حلقهٔ امتیاز
   -------------------------------------------------------------------------- */
export function ringChart({
  value = 0,
  size = 96,
  stroke = 7,
  color = 'var(--brand-400)',
  label = '',
  caption = '',
  className = '',
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = clamp((Number(value) + 100) / 200, 0, 1);
  const offset = circumference * (1 - pct);
  const center = size / 2;

  return `
  <div class="score-ring ${className}" style="--ring-size:${size}px;--ring-color:${color}">
    <svg class="score-ring__svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="score-ring__track" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke}" />
      <circle class="score-ring__value" cx="${center}" cy="${center}" r="${radius}"
        stroke-width="${stroke}"
        style="stroke-dasharray:${circumference.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}" />
    </svg>
    <div class="score-ring__content">
      <span class="score-ring__num">${esc(label !== '' ? label : toFa(value))}</span>
      ${caption ? `<span class="score-ring__caption">${esc(caption)}</span>` : ''}
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   دونات توزیع سه‌سطحی
   -------------------------------------------------------------------------- */
export function donutChart({
  segments = [],
  size = 120,
  thickness = 14,
  centerLabel = '',
  centerCaption = '',
}) {
  const total = segments.reduce((acc, seg) => acc + (Number(seg.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let consumed = 0;

  const arcs = segments
    .map((segment) => {
      const value = Number(segment.value) || 0;
      if (!total || !value) return '';
      const fraction = value / total;
      const dash = circumference * fraction;
      const offset = circumference * consumed;
      consumed += fraction;
      return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none"
        stroke="${segment.color}"
        stroke-width="${thickness}"
        stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}"
        stroke-linecap="butt"
        transform="rotate(-90 ${center} ${center})" />`;
    })
    .join('');

  return `
  <div class="donut" style="position:relative;width:${size}px;height:${size}px;flex:0 0 auto">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}" />
      ${arcs}
    </svg>
    <div style="position:absolute;inset:0;display:grid;place-content:center;text-align:center;line-height:1.1">
      <strong style="font-size:${Math.round(size * 0.2)}px;font-weight:900;letter-spacing:-.04em;color:var(--text-strong)">${esc(
        centerLabel,
      )}</strong>
      ${
        centerCaption
          ? `<span style="font-size:${Math.round(size * 0.085)}px;color:var(--text-faint);margin-top:2px">${esc(
              centerCaption,
            )}</span>`
          : ''
      }
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   میله‌های افقی
   -------------------------------------------------------------------------- */
export function barChart({
  data = [],
  max = null,
  height = 8,
  showValue = true,
  color = 'var(--brand-500)',
  className = '',
}) {
  const peak = max ?? Math.max(1, ...data.map((row) => Number(row.value) || 0));
  const rows = data
    .map((row) => {
      const width = clamp(((Number(row.value) || 0) / peak) * 100, 0, 100);
      return `
        <div class="hist-row" style="display:grid;grid-template-columns:minmax(60px,110px) 1fr 44px;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:var(--fs-2xs);color:var(--text-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(
            row.label,
          )}</span>
          <span style="position:relative;height:${height}px;border-radius:999px;background:var(--surface-2);overflow:hidden">
            <span style="position:absolute;inset-block:0;inset-inline-start:0;width:${width}%;border-radius:inherit;background:${
              row.color || color
            };transition:width var(--dur-slow) var(--ease-out)"></span>
          </span>
          ${
            showValue
              ? `<span style="font-size:var(--fs-2xs);color:var(--text-soft);text-align:end;font-variant-numeric:tabular-nums">${esc(
                  row.display ?? toFa(fmtInt(row.value)),
                )}</span>`
              : ''
          }
        </div>`;
    })
    .join('');
  return `<div class="bar-chart ${className}">${rows}</div>`;
}

/* --------------------------------------------------------------------------
   خط جرقه‌ای
   -------------------------------------------------------------------------- */
export function sparkline({
  points = [],
  width = 240,
  height = 56,
  color = 'var(--brand-400)',
  fill = true,
  strokeWidth = 1.8,
}) {
  if (!points.length) return `<svg class="sparkline" viewBox="0 0 ${width} ${height}"></svg>`;
  const values = points.map((p) => (typeof p === 'number' ? p : Number(p.value) || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1);
  const coords = values.map((value, index) => {
    const x = pad + stepX * index;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0]} ${height} L${coords[0][0]} ${height} Z`;
  const gradId = uid();

  return `
  <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".35" />
        <stop offset="1" stop-color="${color}" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${fill ? `<path d="${area}" fill="url(#${gradId})" stroke="none" />` : ''}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  </svg>`;
}

/* --------------------------------------------------------------------------
   نمودار ستونی زمان‌دار
   -------------------------------------------------------------------------- */
export function columnChart({
  data = [],
  height = 120,
  color = 'var(--brand-500)',
  showLabels = true,
  className = '',
}) {
  const max = Math.max(1, ...data.map((row) => Number(row.value) || 0));
  const cols = data
    .map((row) => {
      const pct = clamp(((Number(row.value) || 0) / max) * 100, 0, 100);
      return `
        <div class="col-chart__col" title="${esc(row.label)}: ${toFa(row.value)}" style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;flex:1;min-width:0">
          <div style="width:100%;max-width:34px;height:${height}px;display:flex;align-items:flex-end;background:var(--surface-1);border-radius:8px;overflow:hidden">
            <span style="width:100%;height:${pct}%;background:${row.color || color};border-radius:8px 8px 0 0;transition:height var(--dur-slow) var(--ease-out);opacity:.9"></span>
          </div>
          ${showLabels ? `<span style="font-size:9px;color:var(--text-faint);white-space:nowrap">${esc(row.label)}</span>` : ''}
        </div>`;
    })
    .join('');
  return `<div class="col-chart ${className}" style="display:flex;align-items:flex-end;gap:6px;direction:rtl">${cols}</div>`;
}

/* --------------------------------------------------------------------------
   نقشهٔ حرارتی
   -------------------------------------------------------------------------- */
export function heatmap({ cells = [], className = '' }) {
  const max = Math.max(1, ...cells.map((cell) => Number(cell.value) || 0));
  const items = cells
    .map((cell) => {
      const level = Math.min(4, Math.ceil(((Number(cell.value) || 0) / max) * 4));
      return `<span class="heatmap__cell" data-level="${level}" title="${esc(cell.label)}: ${toFa(
        cell.value,
      )}"></span>`;
    })
    .join('');
  return `<div class="heatmap ${className}" role="img" aria-label="نقشهٔ فعالیت">${items}</div>`;
}

/* --------------------------------------------------------------------------
   نوار پشته‌ای سه‌سطحی
   -------------------------------------------------------------------------- */
export function stackedLevelBar({ good = 0, meh = 0, bad = 0, height = 8, className = '' }) {
  const total = good + meh + bad || 1;
  return `
  <div class="levelbar ${className}" style="height:${height}px" role="img" aria-label="توزیع امتیازها">
    <span class="levelbar__seg levelbar__seg--good" style="width:${(good / total) * 100}%"></span>
    <span class="levelbar__seg levelbar__seg--meh" style="width:${(meh / total) * 100}%"></span>
    <span class="levelbar__seg levelbar__seg--bad" style="width:${(bad / total) * 100}%"></span>
  </div>`;
}

/* --------------------------------------------------------------------------
   مقیاس سه‌سطحی افقی (برای راهنما)
   -------------------------------------------------------------------------- */
export function levelScale() {
  return `
  <div class="level-scale" style="display:flex;align-items:center;gap:2px;direction:rtl" aria-hidden="true">
    <span style="flex:1;height:10px;border-radius:0 999px 999px 0;background:var(--bad)"></span>
    <span style="flex:1;height:10px;background:var(--meh)"></span>
    <span style="flex:1;height:10px;border-radius:999px 0 0 999px;background:var(--good)"></span>
  </div>`;
}

/* --------------------------------------------------------------------------
   نمودار راداری برای مقایسه (۵ محور)
   -------------------------------------------------------------------------- */
export function radarChart({ axes = [], series = [], size = 220 }) {
  const center = size / 2;
  const radius = size / 2 - 28;
  const count = axes.length || 1;

  const pointFor = (index, value) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = clamp(value, 0, 100) / 100 * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };

  const grid = [25, 50, 75, 100]
    .map((level) => {
      const points = axes
        .map((_, i) => {
          const [x, y] = pointFor(i, level);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      return `<polygon points="${points}" fill="none" stroke="var(--line)" stroke-width="1" />`;
    })
    .join('');

  const axisLines = axes
    .map((_, i) => {
      const [x, y] = pointFor(i, 100);
      return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="var(--line-soft)" />`;
    })
    .join('');

  const labels = axes
    .map((axis, i) => {
      const [x, y] = pointFor(i, 118);
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-mute)" font-size="9">${esc(
        axis.label,
      )}</text>`;
    })
    .join('');

  const shapes = series
    .map((set) => {
      const points = set.values.map((value, i) => {
        const [x, y] = pointFor(i, value);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return `<polygon points="${points.join(' ')}" fill="${set.color}" fill-opacity=".16" stroke="${set.color}" stroke-width="1.6" />`;
    })
    .join('');

  return `
  <svg viewBox="0 0 ${size} ${size}" width="100%" height="${size}" role="img" aria-label="نمودار مقایسه">
    ${grid}${axisLines}${shapes}${labels}
  </svg>`;
}

/* --------------------------------------------------------------------------
   ریز-نمودار توزیع درون‌خطی
   -------------------------------------------------------------------------- */
export function miniDistribution({ good = 0, meh = 0, bad = 0 }) {
  const total = good + meh + bad || 1;
  return `<span class="mini-dist" style="display:inline-flex;height:6px;width:64px;border-radius:999px;overflow:hidden;background:var(--surface-2)">
    <span style="width:${(good / total) * 100}%;background:var(--good)"></span>
    <span style="width:${(meh / total) * 100}%;background:var(--meh)"></span>
    <span style="width:${(bad / total) * 100}%;background:var(--bad)"></span>
  </span>`;
}
