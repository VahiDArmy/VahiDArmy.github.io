/** Hand-built SVG charts. No chart library, no canvas, no runtime dependency. */
import { escapeHtml, formatCompact, formatDuration, formatNumber, formatTokens, uid } from '../utils.js';

const PALETTE = ['var(--accent)', 'var(--jade)', 'var(--rose)', 'var(--azure)', 'var(--amber)', 'var(--violet)'];

function niceMax(value) {
  const n = Number(value) || 0;
  if (n <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  const normalized = n / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function gridLines(maxValue, plot, steps = 4) {
  let out = '';
  for (let i = 0; i <= steps; i += 1) {
    const y = plot.y + plot.h - (plot.h / steps) * i;
    const value = (maxValue / steps) * i;
    out += `<line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.w}" y2="${y}" class="chart-grid"></line>`;
    out += `<text x="${plot.x - 10}" y="${y + 4}" class="chart-axis" text-anchor="end">${escapeHtml(formatCompact(value))}</text>`;
  }
  return out;
}

export function usageChart(series = [], { metric = 'tokens', height = 248 } = {}) {
  if (!series.length) return chartEmpty('No usage in this range yet.');
  const width = 760;
  const padding = { top: 18, right: 18, bottom: 32, left: 52 };
  const plot = { x: padding.left, y: padding.top, w: width - padding.left - padding.right, h: height - padding.top - padding.bottom };
  const isTokens = metric !== 'requests';
  const maxRaw = Math.max(
    ...series.map((bucket) => (isTokens ? (bucket.promptTokens || 0) + (bucket.completionTokens || 0) : bucket.requests || 0)),
    1,
  );
  const max = niceMax(maxRaw);
  const slot = plot.w / series.length;
  const barWidth = Math.max(3, Math.min(34, slot * 0.58));
  const labelEvery = Math.max(1, Math.ceil(series.length / 9));
  const gradientId = `bar-${uid().slice(0, 8)}`;

  let bars = '';
  series.forEach((bucket, index) => {
    const x = plot.x + slot * index + (slot - barWidth) / 2;
    const prompt = isTokens ? bucket.promptTokens || 0 : 0;
    const completion = isTokens ? bucket.completionTokens || 0 : bucket.requests || 0;
    const promptH = (prompt / max) * plot.h;
    const completionH = (completion / max) * plot.h;
    const yBase = plot.y + plot.h;
    const tooltip = `${bucket.label} · ${formatNumber(bucket.requests)} requests · ${formatTokens(bucket.tokens)} tokens`;
    bars += `<g class="chart-bar">
      <title>${escapeHtml(tooltip)}</title>
      <rect x="${x.toFixed(1)}" y="${(yBase - completionH - promptH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(promptH, 0.5).toFixed(1)}" rx="${Math.min(3, barWidth / 2)}" fill="url(#${gradientId})" class="chart-bar__prompt"></rect>
      <rect x="${x.toFixed(1)}" y="${(yBase - completionH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(completionH, 0.5).toFixed(1)}" rx="${Math.min(3, barWidth / 2)}" class="chart-bar__completion"></rect>
    </g>`;
    if (index % labelEvery === 0 || index === series.length - 1) {
      bars += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${plot.y + plot.h + 21}" class="chart-axis chart-axis--x" text-anchor="middle">${escapeHtml(bucket.label)}</text>`;
    }
  });

  return `<div class="chart">
    <div class="chart__legend">
      <span><i class="legend-dot legend-dot--accent"></i>${isTokens ? 'Prompt tokens' : 'Requests'}</span>
      ${isTokens ? '<span><i class="legend-dot legend-dot--jade"></i>Completion tokens</span>' : ''}
    </div>
    <svg class="chart__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Usage over time">
      <defs><linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"></stop><stop offset="1" stop-color="var(--accent)"></stop></linearGradient></defs>
      ${gridLines(max, plot)}
      ${bars}
    </svg>
  </div>`;
}

export function donutChart(segments = [], { size = 168, thickness = 15, centerLabel = '', centerValue = '' } = {}) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  let rings = '';
  if (total > 0) {
    for (const segment of segments) {
      const value = Number(segment.value || 0);
      if (!value) continue;
      const length = (value / total) * circumference;
      rings += `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="${thickness}" stroke-dasharray="${length - 2} ${circumference - length + 2}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="butt"><title>${escapeHtml(segment.label)}: ${formatNumber(value)}</title></circle>`;
      offset += length;
    }
  }
  return `<div class="donut">
    <div class="donut__visual">
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Status distribution">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--line)" stroke-width="${thickness}"></circle>
        ${rings}
      </svg>
      <div class="donut__center"><strong>${escapeHtml(centerValue)}</strong><span>${escapeHtml(centerLabel)}</span></div>
    </div>
    <div class="donut__legend">
      ${segments
        .map(
          (segment) =>
            `<div class="donut__row"><span class="donut__label"><i style="background:${segment.color}"></i>${escapeHtml(segment.label)}</span><strong>${formatNumber(segment.value)}</strong></div>`,
        )
        .join('')}
    </div>
  </div>`;
}

export function sparkline(values = [], { width = 120, height = 32, className = '' } = {}) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => ({
    x: index * step,
    y: height - ((value - min) / span) * (height - 4) - 2,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `spark-${uid().slice(0, 6)}`;
  return `<svg class="sparkline ${className}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"></stop><stop offset="1" stop-color="var(--accent)" stop-opacity="0"></stop></linearGradient></defs>
    <path d="${area}" fill="url(#${id})"></path>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"></path>
  </svg>`;
}

export function latencyBars(rows = []) {
  const valid = rows.filter((row) => row.avgLatency);
  if (!valid.length) return chartEmpty('Latency appears after your first completed reply.');
  const max = Math.max(...valid.map((row) => row.avgLatency), 1);
  return `<div class="latency-bars">
    ${valid
      .slice(0, 8)
      .map(
        (row) => `<div class="latency-row">
          <div class="latency-row__head"><span>${escapeHtml(row.name)}</span><strong>${formatDuration(row.avgLatency)}</strong></div>
          <div class="latency-row__track"><span style="width:${Math.max(3, (row.avgLatency / max) * 100).toFixed(1)}%"></span></div>
        </div>`,
      )
      .join('')}
  </div>`;
}

export function distributionBars(segments = []) {
  const total = segments.reduce((sum, segment) => sum + Number(segment.value || 0), 0) || 1;
  return `<div class="distribution">
    <div class="distribution__bar">
      ${segments
        .map(
          (segment, index) =>
            `<span style="width:${((Number(segment.value) || 0) / total) * 100}%;background:${segment.color || PALETTE[index % PALETTE.length]}" title="${escapeHtml(segment.label)}: ${formatNumber(segment.value)}"></span>`,
        )
        .join('')}
    </div>
    <div class="distribution__legend">
      ${segments
        .map(
          (segment, index) =>
            `<span><i style="background:${segment.color || PALETTE[index % PALETTE.length]}"></i>${escapeHtml(segment.label)} <strong>${formatNumber(segment.value)}</strong></span>`,
        )
        .join('')}
    </div>
  </div>`;
}

export function chartEmpty(message = 'Nothing to chart yet.') {
  return `<div class="chart-empty"><span class="chart-empty__glyph" aria-hidden="true">◌</span><p>${escapeHtml(message)}</p></div>`;
}

export function chartPalette(index) {
  return PALETTE[index % PALETTE.length];
}
