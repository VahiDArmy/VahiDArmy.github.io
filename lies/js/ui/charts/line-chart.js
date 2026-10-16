/* ============================================================
   js/ui/charts/line-chart.js
   Smooth area/line chart with hover tooltip
   ============================================================ */

import { svgEl, smoothPath, linearScale, niceTicks, chartLabel, showChartTooltip, hideChartTooltip } from './chart-utils.js';

/**
 * @param {{
 *   data: Array<{label:string, value:number}>,
 *   height?: number,
 *   color?: string,
 *   fillGradient?: boolean,
 *   showDots?: boolean,
 *   showGrid?: boolean,
 *   showXAxis?: boolean,
 *   showYAxis?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function lineChart(opts) {
  const {
    data = [],
    height = 220,
    color = 'var(--accent)',
    fillGradient = true,
    showDots = false,
    showGrid = true,
    showXAxis = true,
    showYAxis = true,
  } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'chart chart--line';

  if (!data.length) {
    wrap.classList.add('chart--empty');
    wrap.textContent = 'داده‌ای برای نمایش نیست';
    return wrap;
  }

  const padTop = 16;
  const padBottom = showXAxis ? 34 : 12;
  const padLeft = showYAxis ? 34 : 12;
  const padRight = 16;

  const width = 640;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const values = data.map((d) => d.value);
  const maxV = Math.max(...values, 1);
  const minV = 0;

  const x = linearScale([0, data.length - 1], [padLeft, padLeft + innerW]);
  const y = linearScale([minV, maxV], [padTop + innerH, padTop]);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    class: 'chart__svg',
    width: '100%',
    height: String(height),
  });

  // Gradient
  if (fillGradient) {
    const defs = svgEl('defs');
    const gradId = `lc_grad_${Math.random().toString(36).slice(2, 8)}`;
    const grad = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.35' }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.dataset.gradId = gradId;
  }

  // Grid + Y ticks
  const ticks = niceTicks(0, maxV, 4);
  if (showGrid) {
    const gGrid = svgEl('g', { class: 'chart__grid' });
    for (const t of ticks) {
      const gy = y(t);
      gGrid.appendChild(svgEl('line', {
        x1: padLeft, x2: padLeft + innerW, y1: gy, y2: gy,
        stroke: 'var(--border-subtle)',
        'stroke-width': '1',
        'stroke-dasharray': '2 4',
      }));
    }
    svg.appendChild(gGrid);
  }

  if (showYAxis) {
    const gY = svgEl('g', { class: 'chart__axis-y' });
    for (const t of ticks) {
      const label = svgEl('text', {
        x: padLeft - 8,
        y: y(t) + 4,
        'text-anchor': 'end',
        'font-size': '10',
        fill: 'var(--text-tertiary)',
      });
      label.textContent = chartLabel(t);
      gY.appendChild(label);
    }
    svg.appendChild(gY);
  }

  // Points
  const pts = data.map((d, i) => [x(i), y(d.value)]);

  // Area fill
  if (fillGradient) {
    const areaD = smoothPath(pts) + ` L${x(data.length - 1)},${padTop + innerH} L${x(0)},${padTop + innerH} Z`;
    svg.appendChild(svgEl('path', {
      d: areaD,
      fill: `url(#${svg.dataset.gradId})`,
      stroke: 'none',
    }));
  }

  // Line
  svg.appendChild(svgEl('path', {
    d: smoothPath(pts),
    fill: 'none',
    stroke: color,
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'chart__line',
  }));

  // Dots
  if (showDots) {
    for (const [px, py] of pts) {
      svg.appendChild(svgEl('circle', {
        cx: px, cy: py, r: 3,
        fill: 'var(--bg-surface)',
        stroke: color,
        'stroke-width': '2',
      }));
    }
  }

  // X axis labels
  if (showXAxis) {
    const gX = svgEl('g', { class: 'chart__axis-x' });
    const step = Math.max(1, Math.ceil(data.length / 7));
    data.forEach((d, i) => {
      if (i % step !== 0 && i !== data.length - 1) return;
      const label = svgEl('text', {
        x: x(i),
        y: padTop + innerH + 20,
        'text-anchor': 'middle',
        'font-size': '10',
        fill: 'var(--text-tertiary)',
      });
      label.textContent = d.label;
      gX.appendChild(label);
    });
    svg.appendChild(gX);
  }

  // Hover overlay
  const hover = svgEl('g', { class: 'chart__hover', opacity: '0' });
  const hoverLine = svgEl('line', {
    y1: padTop, y2: padTop + innerH,
    stroke: 'var(--accent)',
    'stroke-width': '1',
    'stroke-dasharray': '3 3',
    opacity: '0.6',
  });
  const hoverDot = svgEl('circle', {
    r: 5,
    fill: 'var(--accent)',
    stroke: 'var(--bg-surface)',
    'stroke-width': '2',
  });
  hover.appendChild(hoverLine);
  hover.appendChild(hoverDot);
  svg.appendChild(hover);

  // Mouse handling
  svg.addEventListener('mousemove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const relX = ((ev.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((relX - padLeft) / innerW) * (data.length - 1));
    if (idx < 0 || idx >= data.length) return;
    const [px, py] = pts[idx];
    hover.setAttribute('opacity', '1');
    hoverLine.setAttribute('x1', px);
    hoverLine.setAttribute('x2', px);
    hoverDot.setAttribute('cx', px);
    hoverDot.setAttribute('cy', py);

    const item = data[idx];
    showChartTooltip(ev.clientX, ev.clientY, `
      <div class="chart-tooltip__label">${item.label}</div>
      <div class="chart-tooltip__value">${chartLabel(item.value)}</div>
    `);
  });
  svg.addEventListener('mouseleave', () => {
    hover.setAttribute('opacity', '0');
    hideChartTooltip();
  });

  wrap.appendChild(svg);
  return wrap;
}

export default { lineChart };