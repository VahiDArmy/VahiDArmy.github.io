/* ============================================================================
   FULL METAL CINEMA — charts
   Hand-rolled SVG. No chart library, no canvas state, no dependencies.
   ========================================================================== */

import { h, fmtNum } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    el.setAttribute(k, String(v));
  }
  return el;
};
const uid = (() => { let n = 0; return (p = 'g') => `${p}${++n}`; })();

function frame(width, height, label) {
  const svg = svgEl('svg', {
    class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none',
    role: 'img', 'aria-label': label || 'chart',
  });
  svg.style.height = `${height}px`;
  return svg;
}

/* ---------- vertical bars ---------------------------------------------- */
export function barChart(data, {
  height = 170, width = 520, gap = 6, showValues = false, maxLabels = 18, labelRotate = 0,
} = {}) {
  const svg = frame(width, height, 'bar chart');
  const items = data.filter((d) => d && d.value != null);
  if (!items.length) return svg;
  const pad = { l: 26, r: 6, t: 8, b: 24 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const max = Math.max(...items.map((d) => d.value), 1);
  const bw = (plotW - gap * (items.length - 1)) / items.length;

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = pad.t + (plotH / ticks) * i;
    svg.appendChild(svgEl('line', { x1: pad.l, x2: width - pad.r, y1: y, y2: y, class: 'gridline', opacity: i === ticks ? 1 : 0.5 }));
    const t = svgEl('text', { x: 0, y: y + 3 });
    t.textContent = fmtNum(Math.round(max - (max / ticks) * i));
    svg.appendChild(t);
  }

  items.forEach((d, i) => {
    const bh = Math.max(1, (d.value / max) * plotH);
    const x = pad.l + i * (bw + gap);
    const rect = svgEl('rect', {
      x, y: pad.t + plotH - bh, width: Math.max(2, bw), height: bh,
      class: d.cls || 'bar', rx: 0,
    });
    rect.appendChild(svgEl('title')).textContent = `${d.label}: ${d.value}`;
    svg.appendChild(rect);
    if (showValues && bh > 16) {
      const t = svgEl('text', { x: x + bw / 2, y: pad.t + plotH - bh - 4, 'text-anchor': 'middle' });
      t.textContent = fmtNum(d.value);
      svg.appendChild(t);
    }
    if (items.length <= maxLabels) {
      const t = svgEl('text', {
        x: x + bw / 2, y: height - 8,
        'text-anchor': labelRotate ? 'end' : 'middle',
      });
      if (labelRotate) t.setAttribute('transform', `rotate(${labelRotate} ${x + bw / 2} ${height - 8})`);
      t.textContent = String(d.label).slice(0, labelRotate ? 22 : 12);
      svg.appendChild(t);
    }
  });
  return svg;
}

/* ---------- horizontal bars -------------------------------------------- */
export function hBarChart(data, { width = 420, rowH = 22, showValues = true } = {}) {
  const items = data.filter((d) => d && d.value != null).slice(0, 14);
  const height = Math.max(rowH, items.length * rowH + 6);
  const svg = frame(width, height, 'bar chart');
  if (!items.length) return svg;
  const labelW = 108;
  const max = Math.max(...items.map((d) => d.value), 1);
  items.forEach((d, i) => {
    const y = i * rowH + 4;
    const t = svgEl('text', { x: 0, y: y + 11, class: 'lbl' });
    t.textContent = String(d.label).slice(0, 18);
    svg.appendChild(t);
    const barW = Math.max(2, ((width - labelW - 34) * d.value) / max);
    svg.appendChild(svgEl('rect', {
      x: labelW, y: y + 4, width: barW, height: 9,
      fill: d.color || 'var(--accent)', opacity: d.opacity ?? 0.95,
    }));
    if (showValues) {
      const v = svgEl('text', { x: labelW + barW + 6, y: y + 12 });
      v.textContent = fmtNum(d.value);
      svg.appendChild(v);
    }
  });
  return svg;
}

/* ---------- line chart ------------------------------------------------- */
export function lineChart(points, {
  height = 180, width = 560, fill = true, dots = true, yMax = null, yMin = 0,
} = {}) {
  const svg = frame(width, height, 'line chart');
  const data = points.filter((p) => p && p.value != null);
  if (data.length < 2) return svg;
  const pad = { l: 30, r: 10, t: 12, b: 24 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const max = yMax ?? Math.max(...data.map((d) => d.value), 1);
  const min = yMin ?? Math.min(...data.map((d) => d.value), 0);
  const span = max - min || 1;
  const xOf = (i) => pad.l + (plotW * i) / (data.length - 1);
  const yOf = (v) => pad.t + plotH - ((v - min) / span) * plotH;

  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH / 4) * i;
    svg.appendChild(svgEl('line', { x1: pad.l, x2: width - pad.r, y1: y, y2: y, class: 'gridline', opacity: 0.5 }));
    const t = svgEl('text', { x: 0, y: y + 3 });
    t.textContent = fmtNum(Math.round(max - (span / 4) * i));
    svg.appendChild(t);
  }

  const path = data.map((d, i) => `${i ? 'L' : 'M'}${xOf(i)},${yOf(d.value)}`).join(' ');
  if (fill) {
    const gid = uid('area');
    const grad = svgEl('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 });
    const s1 = svgEl('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': 0.32 });
    const s2 = svgEl('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': 0 });
    grad.appendChild(s1); grad.appendChild(s2);
    const defs = svgEl('defs'); defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(svgEl('path', {
      d: `${path} L${xOf(data.length - 1)},${pad.t + plotH} L${xOf(0)},${pad.t + plotH} Z`,
      fill: `url(#${gid})`,
    }));
  }
  svg.appendChild(svgEl('path', { d: path, class: 'linepath' }));
  if (dots) {
    data.forEach((d, i) => {
      const c = svgEl('circle', { cx: xOf(i), cy: yOf(d.value), r: 3, class: 'dotm' });
      c.appendChild(svgEl('title')).textContent = `${d.label}: ${d.value}`;
      svg.appendChild(c);
    });
  }
  const step = Math.ceil(data.length / 8);
  data.forEach((d, i) => {
    if (i % step) return;
    const t = svgEl('text', { x: xOf(i), y: height - 6, 'text-anchor': 'middle' });
    t.textContent = String(d.label).slice(0, 8);
    svg.appendChild(t);
  });
  return svg;
}

/* ---------- donut ------------------------------------------------------ */
export function donutChart(data, {
  size = 180, thickness = 26, centerValue = '', centerLabel = '',
} = {}) {
  const svg = frame(size, size, 'donut chart');
  const items = data.filter((d) => d && d.value > 0);
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total) return svg;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  let angle = -Math.PI / 2;
  items.forEach((d) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const path = svgEl('path', {
      d: arcPath(cx, cy, r, r - thickness, angle, angle + sweep),
      fill: d.color || 'var(--accent)',
      class: 'arc',
    });
    path.appendChild(svgEl('title')).textContent = `${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`;
    svg.appendChild(path);
    angle += sweep;
  });
  if (centerValue !== '' && centerValue != null) {
    const t = svgEl('text', {
      x: cx, y: cy + 2, 'text-anchor': 'middle',
      style: 'font-family:var(--font-display);font-size:26px;font-weight:900;fill:var(--ink)',
    });
    t.textContent = centerValue;
    svg.appendChild(t);
  }
  if (centerLabel) {
    const t = svgEl('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', style: 'font-size:8px;letter-spacing:.2em' });
    t.textContent = centerLabel.toUpperCase();
    svg.appendChild(t);
  }
  return svg;
}

function arcPath(cx, cy, rOut, rIn, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(rOut, a0);
  const [x1, y1] = p(rOut, a1);
  const [x2, y2] = p(rIn, a1);
  const [x3, y3] = p(rIn, a0);
  return `M${x0},${y0} A${rOut},${rOut} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rIn},${rIn} 0 ${large} 0 ${x3},${y3} Z`;
}

/* ---------- radar ------------------------------------------------------ */
export function radarChart(data, { size = 240, max = 10 } = {}) {
  const svg = frame(size, size, 'radar chart');
  const items = data.filter((d) => d);
  if (items.length < 3) return svg;
  const cx = size / 2, cy = size / 2, r = size / 2 - 26;
  const angleOf = (i) => (Math.PI * 2 * i) / items.length - Math.PI / 2;

  [0.25, 0.5, 0.75, 1].forEach((f) => {
    const pts = items.map((_, i) => {
      const a = angleOf(i);
      return `${cx + r * f * Math.cos(a)},${cy + r * f * Math.sin(a)}`;
    }).join(' ');
    svg.appendChild(svgEl('polygon', { points: pts, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1 }));
  });

  items.forEach((d, i) => {
    const a = angleOf(i);
    svg.appendChild(svgEl('line', {
      x1: cx, y1: cy, x2: cx + r * Math.cos(a), y2: cy + r * Math.sin(a),
      stroke: 'var(--line)', 'stroke-width': 1,
    }));
    const lx = cx + (r + 14) * Math.cos(a);
    const ly = cy + (r + 14) * Math.sin(a);
    const t = svgEl('text', { x: lx, y: ly, 'text-anchor': 'middle', style: 'font-size:8px' });
    t.textContent = String(d.label).toUpperCase();
    svg.appendChild(t);
  });

  const pts = items.map((d, i) => {
    const a = angleOf(i);
    const v = Math.max(0, Math.min(1, (Number(d.value) || 0) / max));
    return `${cx + r * v * Math.cos(a)},${cy + r * v * Math.sin(a)}`;
  }).join(' ');
  svg.appendChild(svgEl('polygon', {
    points: pts, fill: 'color-mix(in srgb, var(--accent) 22%, transparent)',
    stroke: 'var(--accent)', 'stroke-width': 2,
  }));
  return svg;
}

/* ---------- sparkline -------------------------------------------------- */
export function sparkline(values, { width = 96, height = 26, color = 'var(--accent)' } = {}) {
  const svg = frame(width, height, 'sparkline');
  const data = values.map(Number).filter((n) => !Number.isNaN(n));
  if (data.length < 2) return svg;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const path = data.map((v, i) => {
    const x = (width * i) / (data.length - 1);
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: color, 'stroke-width': 1.6 }));
  const last = data[data.length - 1];
  svg.appendChild(svgEl('circle', {
    cx: width - 1, cy: height - 2 - ((last - min) / span) * (height - 4), r: 2, fill: color,
  }));
  return svg;
}

/* ---------- stacked / grouped columns ---------------------------------- */
export function stackedColumns(series, { height = 200, width = 560 } = {}) {
  // series: [{ label, segments: [{ value, color, name }] }]
  const svg = frame(width, height, 'stacked columns');
  if (!series.length) return svg;
  const pad = { l: 26, r: 6, t: 10, b: 22 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const totals = series.map((s) => s.segments.reduce((a, b) => a + b.value, 0));
  const max = Math.max(...totals, 1);
  const bw = Math.min(38, plotW / series.length - 8);
  series.forEach((s, i) => {
    const x = pad.l + (plotW / series.length) * i + (plotW / series.length - bw) / 2;
    let y = pad.t + plotH;
    s.segments.forEach((seg) => {
      const segH = (seg.value / max) * plotH;
      const r = svgEl('rect', { x, y: y - segH, width: bw, height: Math.max(0, segH), fill: seg.color });
      r.appendChild(svgEl('title')).textContent = `${s.label} · ${seg.name}: ${seg.value}`;
      svg.appendChild(r);
      y -= segH;
    });
    const t = svgEl('text', { x: x + bw / 2, y: height - 6, 'text-anchor': 'middle' });
    t.textContent = String(s.label).slice(0, 10);
    svg.appendChild(t);
  });
  return svg;
}

/* ---------- heat strip ------------------------------------------------- */
export function heatGrid(cells, { cell = 11, gap = 3 } = {}) {
  const wrap = h('div', { class: 'heat' });
  cells.forEach((c) => {
    wrap.appendChild(h('div', {
      class: 'heat__cell',
      dataset: { v: String(c.level) },
      title: `${c.date} — ${c.n} logged`,
      style: { width: `${cell}px`, height: `${cell}px`, marginBottom: `${gap}px` },
    }));
  });
  return wrap;
}

/* ---------- progress ring --------------------------------------------- */
export function progressRing(value, max, { size = 96, stroke = 7, label = '' } = {}) {
  const svg = frame(size, size, 'progress');
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  svg.appendChild(svgEl('circle', {
    cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--bg-4)', 'stroke-width': stroke,
  }));
  svg.appendChild(svgEl('circle', {
    cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--accent)', 'stroke-width': stroke,
    'stroke-dasharray': `${c * pct} ${c}`, 'stroke-linecap': 'butt',
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
  }));
  const t = svgEl('text', {
    x: size / 2, y: size / 2 + 4, 'text-anchor': 'middle',
    style: 'font-family:var(--font-display);font-size:19px;font-weight:800;fill:var(--ink)',
  });
  t.textContent = `${Math.round(pct * 100)}%`;
  svg.appendChild(t);
  if (label) {
    const l = svgEl('text', { x: size / 2, y: size / 2 + 18, 'text-anchor': 'middle', style: 'font-size:7px;letter-spacing:.16em' });
    l.textContent = label.toUpperCase();
    svg.appendChild(l);
  }
  return svg;
}
