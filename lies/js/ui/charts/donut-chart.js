/* ============================================================
   js/ui/charts/donut-chart.js
   Donut / pie chart with legend and center label
   ============================================================ */

import { svgEl, donutArc, chartLabel } from './chart-utils.js';

/**
 * @param {{
 *   data: Array<{label:string, value:number, color?:string, icon?:string}>,
 *   size?: number,
 *   thickness?: number,
 *   centerLabel?: string,
 *   centerSub?: string,
 *   showLegend?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function donutChart(opts) {
  const {
    data = [],
    size = 220,
    thickness = 30,
    centerLabel = '',
    centerSub = '',
    showLegend = true,
  } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'chart chart--donut';

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) {
    wrap.classList.add('chart--empty');
    wrap.textContent = 'داده‌ای برای نمایش نیست';
    return wrap;
  }

  const svgWrap = document.createElement('div');
  svgWrap.className = 'chart__donut-wrap';

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const r2 = r - thickness;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    width: String(size),
    height: String(size),
    class: 'chart__svg chart__svg--donut',
  });

  // Track
  svg.appendChild(svgEl('circle', {
    cx, cy, r: r - thickness / 2,
    fill: 'none',
    stroke: 'var(--bg-surface-3)',
    'stroke-width': thickness,
  }));

  const palette = [
    'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)',
    'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)', 'var(--cat-8)',
  ];

  let angle = -Math.PI / 2;
  data.forEach((d, i) => {
    const frac = d.value / total;
    const sweep = frac * Math.PI * 2;
    const color = d.color || palette[i % palette.length];

    const path = svgEl('path', {
      d: donutArc(cx, cy, r, r2, angle, angle + sweep - 0.008),
      fill: color,
      class: 'chart__arc',
      opacity: '0.92',
    });
    path.addEventListener('mouseenter', () => {
      path.setAttribute('opacity', '1');
      path.setAttribute('transform', `translate(${cx} ${cy}) scale(1.03) translate(${-cx} ${-cy})`);
    });
    path.addEventListener('mouseleave', () => {
      path.setAttribute('opacity', '0.92');
      path.removeAttribute('transform');
    });
    svg.appendChild(path);
    angle += sweep;
  });

  // Center text
  if (centerLabel || centerSub) {
    const g = svgEl('g');
    if (centerLabel) {
      const t1 = svgEl('text', {
        x: cx, y: cy - 2,
        'text-anchor': 'middle',
        'font-size': '24',
        'font-weight': '800',
        fill: 'var(--text-primary)',
      });
      t1.textContent = centerLabel;
      g.appendChild(t1);
    }
    if (centerSub) {
      const t2 = svgEl('text', {
        x: cx, y: cy + 18,
        'text-anchor': 'middle',
        'font-size': '11',
        fill: 'var(--text-tertiary)',
      });
      t2.textContent = centerSub;
      g.appendChild(t2);
    }
    svg.appendChild(g);
  }

  svgWrap.appendChild(svg);
  wrap.appendChild(svgWrap);

  // Legend
  if (showLegend) {
    const legend = document.createElement('ul');
    legend.className = 'chart__legend';
    data.forEach((d, i) => {
      const color = d.color || palette[i % palette.length];
      const li = document.createElement('li');
      li.className = 'chart__legend-item';
      const pct = ((d.value / total) * 100).toFixed(0);
      li.innerHTML = `
        <span class="chart__legend-dot" style="background:${color}"></span>
        <span class="chart__legend-label">${d.icon ? d.icon + ' ' : ''}${d.label}</span>
        <span class="chart__legend-value">${chartLabel(d.value)} <small>(${chartLabel(pct)}٪)</small></span>
      `;
      legend.appendChild(li);
    });
    wrap.appendChild(legend);
  }

  return wrap;
}

export default { donutChart };