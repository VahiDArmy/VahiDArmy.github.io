/**
 * Chart primitives — small, dependency-free SVG charts.
 *
 *   lineChart({ data: [{x, y}], width, height, ... })
 *   barChart({ data: [{ label, value }], ... })
 *   donut({ slices: [{ label, value, color }], ... })
 *   sparkline({ values: [...] })
 *   heatmap({ cells: [{ date, level }], ... })
 *
 * Every function returns an SVG string ready for innerHTML. Colors come
 * from CSS variables so the theme can be swapped without touching JS.
 */

const NS = "http://www.w3.org/2000/svg";

const VARS = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  text: "var(--color-text-3)",
  grid: "rgba(255,255,255,0.06)",
};

function ensureDefs() {
  return `
    <defs>
      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="50%" stop-color="#8b5cf6"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#4f46e5"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
      <linearGradient id="radialGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
      <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
    </defs>
  `;
}

/* ---------- Line chart ------------------------------------------------- */
export function lineChart({
  data = [],
  width = 720,
  height = 220,
  padding = { top: 20, right: 16, bottom: 32, left: 36 },
  smooth = true,
  showDots = true,
  yTicks = 4,
  xLabel = (d) => d.label ?? "",
  yFormat = (v) => Math.round(v),
} = {}) {
  if (!data.length) return emptyChart(width, height);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = data.map((d) => Number(d.y) || 0);
  const maxY = Math.max(...values, 1);
  const minY = Math.min(...values, 0);
  const rangeY = maxY - minY || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const pts = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerH - ((Number(d.y) || 0) - minY) / rangeY * innerH,
    d,
  }));

  const linePath = buildSmoothPath(pts, smooth);
  const areaPath =
    `${linePath} L ${pts[pts.length - 1].x} ${padding.top + innerH} ` +
    `L ${pts[0].x} ${padding.top + innerH} Z`;

  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const y = padding.top + (innerH / yTicks) * i;
    const value = maxY - (rangeY / yTicks) * i;
    return `
      <line class="chart__grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>
      <text class="chart__axis-label" x="${padding.left - 6}" y="${y + 3}" text-anchor="end">${yFormat(value)}</text>
    `;
  }).join("");

  const xLabels = pts.map((p, i) => {
    if (data.length > 8 && i % Math.ceil(data.length / 8) !== 0) return "";
    return `<text class="chart__axis-label" x="${p.x}" y="${height - 8}" text-anchor="middle">${escapeHtml(xLabel(p.d))}</text>`;
  }).join("");

  const dots = showDots
    ? pts.map((p) => `
        <circle class="chart__dot" cx="${p.x}" cy="${p.y}" r="3.5" data-index="${data.indexOf(p.d)}">
          <title>${escapeHtml(xLabel(p.d))}: ${yFormat(p.d.y)}</title>
        </circle>
      `).join("")
    : "";

  return `
    <svg class="chart__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">
      ${ensureDefs()}
      ${gridLines}
      <path class="chart__area" d="${areaPath}"/>
      <path class="chart__line" d="${linePath}"/>
      ${dots}
      ${xLabels}
    </svg>
  `;
}

function buildSmoothPath(points, smooth) {
  if (!points.length) return "";
  if (!smooth || points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ---------- Bar chart -------------------------------------------------- */
export function barChart({
  data = [],
  width = 720,
  height = 220,
  padding = { top: 20, right: 16, bottom: 32, left: 36 },
  colors,
  yFormat = (v) => Math.round(v),
} = {}) {
  if (!data.length) return emptyChart(width, height);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = data.map((d) => Number(d.value) || 0);
  const maxY = Math.max(...values, 1);
  const gap = 10;
  const barW = Math.max(6, (innerW - gap * (data.length - 1)) / data.length);

  const bars = data.map((d, i) => {
    const v = Number(d.value) || 0;
    const h = (v / maxY) * innerH;
    const x = padding.left + i * (barW + gap);
    const y = padding.top + innerH - h;
    const fill = d.color || colors?.[i] || "url(#barGradient)";
    return `
      <rect class="chart__bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${fill}">
        <title>${escapeHtml(d.label || "")}: ${yFormat(v)}</title>
      </rect>
      <text class="chart__axis-label" x="${x + barW / 2}" y="${height - 8}" text-anchor="middle">${escapeHtml(d.label || "")}</text>
    `;
  }).join("");

  const yLines = Array.from({ length: 5 }, (_, i) => {
    const y = padding.top + (innerH / 4) * i;
    const value = maxY - (maxY / 4) * i;
    return `
      <line class="chart__grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>
      <text class="chart__axis-label" x="${padding.left - 6}" y="${y + 3}" text-anchor="end">${yFormat(value)}</text>
    `;
  }).join("");

  return `
    <svg class="chart__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">
      ${ensureDefs()}
      ${yLines}
      ${bars}
    </svg>
  `;
}

/* ---------- Donut ------------------------------------------------------ */
export function donut({
  slices = [],
  size = 220,
  thickness = 22,
  centerLabel = "",
  centerSub = "",
} = {}) {
  const total = slices.reduce((s, x) => s + (Number(x.value) || 0), 0);
  if (!total) return emptyChart(size, size);

  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;

  const segments = slices.map((s, i) => {
    const v = Number(s.value) || 0;
    const frac = v / total;
    const start = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const end = acc * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    const color = s.color || defaultSliceColor(i);
    return `
      <path class="chart__donut-segment" d="${d}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="butt">
        <title>${escapeHtml(s.label || "")}: ${v}</title>
      </path>
    `;
  }).join("");

  return `
    <svg class="chart__svg" viewBox="0 0 ${size} ${size}" role="img">
      ${segments}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--color-text-1)" font-size="22" font-weight="800" font-family="var(--font-family)">${escapeHtml(centerLabel)}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="var(--color-text-3)" font-size="11" font-family="var(--font-family)">${escapeHtml(centerSub)}</text>
    </svg>
  `;
}

/* ---------- Sparkline -------------------------------------------------- */
export function sparkline({ values = [], width = 200, height = 40, color = VARS.primary } = {}) {
  if (!values.length) return `<svg class="sparkline" viewBox="0 0 ${width} ${height}"></svg>`;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: height - 4 - ((Number(v) - min) / range) * (height - 8),
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
      <path class="sparkline__area" d="${area}" fill="${color}" fill-opacity="0.14"/>
      <path class="sparkline__line" d="${line}" stroke="${color}"/>
    </svg>
  `;
}

/* ---------- Radial / ring ---------------------------------------------- */
export function radial({
  value = 0,
  max = 100,
  size = 160,
  thickness = 12,
  label,
  sublabel,
} = {}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = c * (1 - pct);

  return `
    <div class="radial" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}" role="img">
        ${ensureDefs()}
        <circle class="radial__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${thickness}"/>
        <circle class="radial__bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${thickness}"
                stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="radial__label">
        <span>${label ?? Math.round(pct * 100) + "٪"}</span>
        ${sublabel ? `<small>${escapeHtml(sublabel)}</small>` : ""}
      </div>
    </div>
  `;
}

/* ---------- Heatmap ---------------------------------------------------- */
export function heatmap({ cells = [] } = {}) {
  // Cells are laid out Sat → Fri, column per week.
  // Caller is expected to pass a dense array aligned to week start.
  return `
    <div class="heatmap">
      ${cells.map((c) => `
        <div class="heatmap__cell" data-level="${c.level || 0}" title="${escapeHtml(c.date)} — ${c.value ?? ""}">
        </div>
      `).join("")}
    </div>
  `;
}

/* ---------- Helpers ---------------------------------------------------- */
function emptyChart(w, h) {
  return `
    <svg class="chart__svg" viewBox="0 0 ${w} ${h}">
      <text x="${w / 2}" y="${h / 2}" text-anchor="middle" fill="var(--color-text-4)" font-size="12" font-family="var(--font-family)">داده‌ای برای نمایش نیست</text>
    </svg>
  `;
}

function defaultSliceColor(i) {
  const palette = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return palette[i % palette.length];
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const chart = { lineChart, barChart, donut, sparkline, radial, heatmap };