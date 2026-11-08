// AURORA OS — SVG Chart Primitives

import { h } from '../core/dom.js';

const SVGNS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    el.setAttribute(k, v);
  }
  return el;
}

function cssVar(name, fallback = '#7c5cff') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function niceScale(min, max, ticks = 5) {
  const range = max - min || 1;
  const step0 = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const vals = [];
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) vals.push(+v.toFixed(10));
  return { min: niceMin, max: niceMax, step, values: vals };
}

export function sparkline(values, opts = {}) {
  const {
    width = 120, height = 32, stroke = 'var(--accent)', fill = true,
    strokeWidth = 1.5, padding = 2,
  } = opts;
  if (!values.length) return h('svg', { width, height });

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / Math.max(1, values.length - 1);

  const pts = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return [x, y];
  });

  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');

  const svg = svgEl('svg', { width, height, viewBox: '0 0 ' + width + ' ' + height, class: 'sparkline' });
  if (fill) {
    const areaPath = path + ' L' + (width - padding) + ',' + (height - padding) + ' L' + padding + ',' + (height - padding) + ' Z';
    const gradId = 'spark-' + Math.random().toString(36).slice(2, 8);
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.append(
      svgEl('stop', { offset: '0', 'stop-color': stroke, 'stop-opacity': '0.3' }),
      svgEl('stop', { offset: '1', 'stop-color': stroke, 'stop-opacity': '0' })
    );
    defs.append(grad);
    svg.append(defs);
    svg.append(svgEl('path', { d: areaPath, fill: 'url(#' + gradId + ')', stroke: 'none' }));
  }
  svg.append(svgEl('path', {
    d: path, fill: 'none', stroke, 'stroke-width': strokeWidth,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }));
  const last = pts[pts.length - 1];
  svg.append(svgEl('circle', {
    cx: last[0], cy: last[1], r: strokeWidth + 1, fill: stroke,
  }));
  return svg;
}

export function lineChart(series, opts = {}) {
  const {
    width = 600, height = 280, xLabels = [], yTicks = 5,
    padding = { top: 16, right: 16, bottom: 32, left: 44 },
    showGrid = true, showDots = true, smooth = true, area = false,
  } = opts;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.data);
  const { min, max, values: yVals } = niceScale(Math.min(...allValues), Math.max(...allValues), yTicks);

  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, width: '100%', height, class: 'chart chart--line' });

  if (showGrid) {
    for (const yv of yVals) {
      const y = padding.top + innerH - ((yv - min) / (max - min || 1)) * innerH;
      svg.append(svgEl('line', {
        x1: padding.left, y1: y, x2: width - padding.right, y2: y,
        stroke: cssVar('--border', '#e5e5e5'), 'stroke-dasharray': '2,4',
      }));
      const label = svgEl('text', {
        x: padding.left - 8, y: y + 4, 'text-anchor': 'end',
        'font-size': '10', fill: cssVar('--text-3', '#888'),
        'font-family': 'var(--font-sans)',
      });
      label.textContent = yv;
      svg.append(label);
    }
  }

  if (xLabels.length) {
    const step = innerW / Math.max(1, xLabels.length - 1);
    xLabels.forEach((lbl, i) => {
      if (xLabels.length > 10 && i % Math.ceil(xLabels.length / 8) !== 0) return;
      const x = padding.left + i * step;
      const t = svgEl('text', {
        x, y: height - 10, 'text-anchor': 'middle',
        'font-size': '10', fill: cssVar('--text-3', '#888'),
        'font-family': 'var(--font-sans)',
      });
      t.textContent = lbl;
      svg.append(t);
    });
  }

  const n = Math.max(1, series[0]?.data.length - 1);
  for (const s of series) {
    const color = s.color || cssVar('--accent');
    const pts = s.data.map((v, i) => {
      const x = padding.left + (i / n) * innerW;
      const y = padding.top + innerH - ((v - min) / (max - min || 1)) * innerH;
      return [x, y];
    });
    const path = smooth ? catmullRom(pts) : pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
    if (area) {
      const areaPath = path + ' L' + pts[pts.length - 1][0] + ',' + (padding.top + innerH) + ' L' + pts[0][0] + ',' + (padding.top + innerH) + ' Z';
      svg.append(svgEl('path', { d: areaPath, fill: color, 'fill-opacity': '0.12', stroke: 'none' }));
    }
    svg.append(svgEl('path', { d: path, fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    if (showDots) {
      for (const p of pts) svg.append(svgEl('circle', { cx: p[0], cy: p[1], r: 3, fill: color }));
    }
  }
  return svg;
}

function catmullRom(pts) {
  if (pts.length < 2) return '';
  let d = 'M' + pts[0][0] + ',' + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2) + ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
  }
  return d;
}

export function barChart(data, opts = {}) {
  const {
    width = 600, height = 280, horizontal = false, showValues = false,
    padding = { top: 16, right: 16, bottom: 32, left: 44 },
    color = 'var(--accent)', rounded = 4,
  } = opts;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const { min, max, values: yVals } = niceScale(0, Math.max(...data.map((d) => d.value)), 5);
  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, width: '100%', height, class: 'chart chart--bar' });

  for (const yv of yVals) {
    const y = padding.top + innerH - ((yv - min) / (max - min || 1)) * innerH;
    svg.append(svgEl('line', { x1: padding.left, y1: y, x2: width - padding.right, y2: y, stroke: cssVar('--border'), 'stroke-dasharray': '2,4' }));
    const label = svgEl('text', { x: padding.left - 8, y: y + 4, 'text-anchor': 'end', 'font-size': '10', fill: cssVar('--text-3') });
    label.textContent = yv;
    svg.append(label);
  }

  const n = data.length;
  const slot = innerW / n;
  const barW = slot * 0.6;

  for (let i = 0; i < n; i++) {
    const d = data[i];
    const x = padding.left + i * slot + (slot - barW) / 2;
    const bh = ((d.value - min) / (max - min || 1)) * innerH;
    const y = padding.top + innerH - bh;
    const bar = svgEl('rect', {
      x, y, width: barW, height: bh, rx: rounded,
      fill: d.color || color, class: 'bar',
    });
    svg.append(bar);
    if (showValues) {
      const t = svgEl('text', { x: x + barW / 2, y: y - 4, 'text-anchor': 'middle', 'font-size': '10', fill: cssVar('--text-2') });
      t.textContent = d.value;
      svg.append(t);
    }
    const lbl = svgEl('text', { x: x + barW / 2, y: height - 10, 'text-anchor': 'middle', 'font-size': '10', fill: cssVar('--text-3') });
    lbl.textContent = d.label;
    svg.append(lbl);
  }
  return svg;
}

export function donutChart(data, opts = {}) {
  const { size = 200, thickness = 24, showLegend = true, centerLabel = '', centerValue = '' } = opts;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const innerR = r - thickness;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, class: 'chart chart--donut' });

  let acc = 0;
  for (const d of data) {
    const angle = (d.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + angle;
    acc = end;
    if (angle < 0.001) continue;
    const x1 = cx + r * Math.cos(start - Math.PI / 2);
    const y1 = cy + r * Math.sin(start - Math.PI / 2);
    const x2 = cx + r * Math.cos(end - Math.PI / 2);
    const y2 = cy + r * Math.sin(end - Math.PI / 2);
    const x3 = cx + innerR * Math.cos(end - Math.PI / 2);
    const y3 = cy + innerR * Math.sin(end - Math.PI / 2);
    const x4 = cx + innerR * Math.cos(start - Math.PI / 2);
    const y4 = cy + innerR * Math.sin(start - Math.PI / 2);
    const largeArc = angle > Math.PI ? 1 : 0;
    const dPath = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    svg.append(svgEl('path', { d: dPath, fill: d.color || cssVar('--accent'), class: 'donut-slice' }));
  }
  if (centerValue) {
    const t1 = svgEl('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': '20', 'font-weight': '600', fill: cssVar('--text') });
    t1.textContent = centerValue;
    const t2 = svgEl('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': '10', fill: cssVar('--text-3'), 'text-transform': 'uppercase' });
    t2.textContent = centerLabel;
    svg.append(t1, t2);
  }

  if (!showLegend) return svg;
  const legend = h('div', { class: 'chart-legend' });
  for (const d of data) {
    const item = h('div', { class: 'chart-legend__item' });
    const sw = h('span', { class: 'chart-legend__swatch' });
    sw.style.background = d.color || cssVar('--accent');
    item.append(sw, h('span', { class: 'chart-legend__label', text: d.label }), h('span', { class: 'chart-legend__value', text: d.value }));
    legend.append(item);
  }
  return h('div', { class: 'chart-donut-wrap', style: { display: 'flex', alignItems: 'center', gap: '20px' } }, [svg, legend]);
}

export function heatmap(data, opts = {}) {
  const { cellSize = 12, gap = 2, cols = 7, colorLow = 'var(--bg-3)', colorHigh = 'var(--accent)' } = opts;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const rows = Math.ceil(data.length / cols);
  const width = cols * (cellSize + gap);
  const height = rows * (cellSize + gap);
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'chart chart--heatmap' });

  data.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const t = d.value / max;
    const opacity = 0.15 + t * 0.85;
    const rect = svgEl('rect', {
      x: col * (cellSize + gap),
      y: row * (cellSize + gap),
      width: cellSize, height: cellSize, rx: 2,
      fill: colorHigh,
      'fill-opacity': opacity,
    });
    const title = svgEl('title');
    title.textContent = `${d.label || i}: ${d.value}`;
    rect.append(title);
    svg.append(rect);
  });
  return svg;
}

export function radialGauge(value, opts = {}) {
  const { size = 120, thickness = 8, max = 100, color = 'var(--accent)', label = '' } = opts;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const svg = svgEl('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, class: 'chart chart--gauge' });
  svg.append(svgEl('circle', { cx, cy, r, fill: 'none', stroke: cssVar('--bg-3'), 'stroke-width': thickness }));
  svg.append(svgEl('circle', {
    cx, cy, r, fill: 'none', stroke: color, 'stroke-width': thickness,
    'stroke-dasharray': circumference, 'stroke-dashoffset': circumference * (1 - pct),
    'stroke-linecap': 'round', transform: `rotate(-90 ${cx} ${cy})`,
    style: 'transition: stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)',
  }));
  const t1 = svgEl('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': '18', 'font-weight': '600', fill: cssVar('--text') });
  t1.textContent = value;
  svg.append(t1);
  if (label) {
    const t2 = svgEl('text', { x: cx, y: cy + 20, 'text-anchor': 'middle', 'font-size': '9', fill: cssVar('--text-3') });
    t2.textContent = label;
    svg.append(t2);
  }
  return svg;
}

export function areaChart(series, opts = {}) {
  return lineChart(series, { ...opts, area: true, smooth: true });
}

export function scatterPlot(points, opts = {}) {
  const { width = 400, height = 260, padding = { top: 16, right: 16, bottom: 32, left: 44 }, color = 'var(--accent)' } = opts;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const { min: xMin, max: xMax } = niceScale(Math.min(...xs), Math.max(...xs), 4);
  const { min: yMin, max: yMax, values: yVals } = niceScale(Math.min(...ys), Math.max(...ys), 4);
  const svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, width: '100%', height, class: 'chart chart--scatter' });
  for (const yv of yVals) {
    const y = padding.top + innerH - ((yv - yMin) / (yMax - yMin || 1)) * innerH;
    svg.append(svgEl('line', { x1: padding.left, y1: y, x2: width - padding.right, y2: y, stroke: cssVar('--border'), 'stroke-dasharray': '2,4' }));
  }
  for (const p of points) {
    const x = padding.left + ((p.x - xMin) / (xMax - xMin || 1)) * innerW;
    const y = padding.top + innerH - ((p.y - yMin) / (yMax - yMin || 1)) * innerH;
    svg.append(svgEl('circle', { cx: x, cy: y, r: p.r || 4, fill: p.color || color, 'fill-opacity': '0.7' }));
  }
  return svg;
}
