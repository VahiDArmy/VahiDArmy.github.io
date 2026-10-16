/* ============================================================
   js/ui/charts/chart-utils.js
   Shared helpers for SVG chart rendering
   ============================================================ */

import { toFaDigits } from '../../utils/format.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element.
 * @param {string} tag
 * @param {object} [attrs]
 * @returns {SVGElement}
 */
export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * Build a linear scale.
 * @param {[number,number]} domain
 * @param {[number,number]} range
 */
export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/**
 * Generate a smooth line path (Catmull-Rom to Bezier).
 * @param {Array<[number,number]>} points
 * @returns {string}
 */
export function smoothPath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Compute "nice" tick values.
 * @param {number} min
 * @param {number} max
 * @param {number} [count=5]
 * @returns {number[]}
 */
export function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const range = max - min;
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  step *= mag;

  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    out.push(+v.toFixed(6));
  }
  return out;
}

/**
 * Chart tooltip singleton.
 */
let tipEl = null;
export function ensureChartTooltip() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'chart-tooltip';
  document.body.appendChild(tipEl);
  return tipEl;
}

export function showChartTooltip(x, y, html) {
  const tip = ensureChartTooltip();
  tip.innerHTML = html;
  tip.classList.add('is-visible');
  const r = tip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let tx = x + 12;
  let ty = y - r.height - 12;
  if (tx + r.width > vw - 8) tx = x - r.width - 12;
  if (ty < 8) ty = y + 16;
  tip.style.transform = `translate(${tx}px, ${ty}px)`;
}

export function hideChartTooltip() {
  if (tipEl) tipEl.classList.remove('is-visible');
}

/**
 * Format a number for chart labels (Persian).
 * @param {number} v
 * @param {boolean} [fa=true]
 */
export function chartLabel(v, fa = true) {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return fa ? toFaDigits(s) : s;
}

/**
 * Compute donut arc path.
 * @param {number} cx @param {number} cy @param {number} r
 * @param {number} r2 (inner radius)
 * @param {number} startAngle radians
 * @param {number} endAngle radians
 */
export function donutArc(cx, cy, r, r2, startAngle, endAngle) {
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + Math.cos(startAngle) * r;
  const y1 = cy + Math.sin(startAngle) * r;
  const x2 = cx + Math.cos(endAngle) * r;
  const y2 = cy + Math.sin(endAngle) * r;
  const x3 = cx + Math.cos(endAngle) * r2;
  const y3 = cy + Math.sin(endAngle) * r2;
  const x4 = cx + Math.cos(startAngle) * r2;
  const y4 = cy + Math.sin(startAngle) * r2;
  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${r2} ${r2} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}