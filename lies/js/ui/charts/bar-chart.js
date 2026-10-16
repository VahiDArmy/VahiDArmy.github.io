/* ============================================================
   js/ui/charts/bar-chart.js
   Vertical bar chart with hover
   ============================================================ */

import { svgEl, linearScale, niceTicks, chartLabel, showChartTooltip, hideChartTooltip } from './chart-utils.js';

/**
 * @param {{
 *   data: Array<{label:string, value:number, color?:string}>,
 *   height?: number,
 *   color?: string,
 *   showGrid?: boolean,
 *   showValues?: boolean,
 *   maxBars?: number,
 * }} opts
 * @returns {HTMLElement}
 */
export function barChart(opts) {
  const {
    data = [],
    height = 240,
    color = 'var(--accent)',
    showGrid = true,
    showValues = false,
  } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'chart chart--bar';

  if (!data.length) {
    wrap.classList.add('chart--empty');
    wrap.textContent = 'داده‌ای برای نمایش نیست';
    return wrap;
  }

  const padTop = 16;
  const padBottom = 40;
  const padLeft = 34;
  const padRight = 16;
  const width = 640;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxV = Math.max(...data.map((d) => d.value), 1);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    class: 'chart__svg',
    width: '100%',
    height: String(height),
  });

  // Grid
  const ticks = niceTicks(0, maxV, 4);
  if (showGrid) {
    const gGrid = svgEl('g');
    for (const t of ticks) {
      const gy = padTop + innerH - (t / maxV) * innerH;
      gGrid.appendChild(svgEl('line', {
        x1: padLeft, x2: padLeft + innerW, y1: gy, y2: gy,
        stroke: 'var(--border-subtle)',
        'stroke-width': '1',
        'stroke-dasharray': '2 4',
      }));
    }
    svg.appendChild(gGrid);
  }

  // Y labels
  const gY = svgEl('g');
  for (const t of ticks) {
    const gy = padTop + innerH - (t / maxV) * innerH;
    const label = svgEl('text', {
      x: padLeft - 8, y: gy + 4,
      'text-anchor': 'end', 'font-size': '10',
      fill: 'var(--text-tertiary)',
    });
    label.textContent = chartLabel(t);
    gY.appendChild(label);
  }
  svg.appendChild(gY);

  // Bars
  const n = data.length;
  const gap = 6;
  const barW = Math.max(6, (innerW - gap * (n - 1)) / n);

  data.forEach((d, i) => {
    const bx = padLeft + i * (barW + gap);
    const bh = (d.value / maxV) * innerH;
    const by = padTop + innerH - bh;

    const rect = svgEl('rect', {
      x: bx,
      y: padTop + innerH,
      width: barW,
      height: 0,
      rx: Math.min(6, barW / 2),
      fill: d.color || color,
      class: 'chart__bar',
      opacity: '0.9',
    });

    // Animate height
    requestAnimationFrame(() => {
      rect.style.transition = `y 400ms cubic-bezier(.2,.8,.2,1) ${i * 30}ms, height 400ms cubic-bezier(.2,.8,.2,1) ${i * 30}ms`;
      rect.setAttribute('y', by);
      rect.setAttribute('height', bh);
    });

    rect.addEventListener('mouseenter', (ev) => {
      rect.setAttribute('opacity', '1');
      const r = rect.getBoundingClientRect();
      showChartTooltip(r.left + r.width / 2, r.top, `
        <div class="chart-tooltip__label">${d.label}</div>
        <div class="chart-tooltip__value">${chartLabel(d.value)}</div>
      `);
    });
    rect.addEventListener('mouseleave', () => {
      rect.setAttribute('opacity', '0.9');
      hideChartTooltip();
    });

    svg.appendChild(rect);

    // Value label
    if (showValues && d.value > 0) {
      const t = svgEl('text', {
        x: bx + barW / 2,
        y: by - 6,
        'text-anchor': 'middle',
        'font-size': '10',
        'font-weight': '600',
        fill: 'var(--text-secondary)',
      });
      t.textContent = chartLabel(d.value);
      svg.appendChild(t);
    }

    // X label
    const xl = svgEl('text', {
      x: bx + barW / 2,
      y: padTop + innerH + 18,
      'text-anchor': 'middle',
      'font-size': '10',
      fill: 'var(--text-tertiary)',
    });
    xl.textContent = d.label;
    svg.appendChild(xl);
  });

  wrap.appendChild(svg);
  return wrap;
}

export default { barChart };