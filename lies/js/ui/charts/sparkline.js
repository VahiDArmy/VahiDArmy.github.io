/* ============================================================
   js/ui/charts/sparkline.js
   Tiny inline sparkline
   ============================================================ */

import { svgEl, smoothPath, linearScale } from './chart-utils.js';

/**
 * @param {number[]} values
 * @param {{width?:number, height?:number, color?:string, fill?:boolean}} [opts]
 * @returns {SVGElement}
 */
export function sparkline(values = [], opts = {}) {
  const { width = 100, height = 28, color = 'var(--accent)', fill = true } = opts;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    height: String(height),
    class: 'sparkline',
    preserveAspectRatio: 'none',
  });

  if (!values.length) return svg;

  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const x = linearScale([0, values.length - 1], [1, width - 1]);
  const y = linearScale([minV, maxV], [height - 3, 3]);

  const pts = values.map((v, i) => [x(i), y(v)]);

  if (fill) {
    const defs = svgEl('defs');
    const gradId = `sp_${Math.random().toString(36).slice(2, 8)}`;
    const g = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    g.appendChild(svgEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.3' }));
    g.appendChild(svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
    defs.appendChild(g);
    svg.appendChild(defs);

    const areaD = smoothPath(pts) + ` L${x(values.length - 1)},${height} L${x(0)},${height} Z`;
    svg.appendChild(svgEl('path', { d: areaD, fill: `url(#${gradId})` }));
  }

  svg.appendChild(svgEl('path', {
    d: smoothPath(pts),
    fill: 'none',
    stroke: color,
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));

  return svg;
}

export default { sparkline };