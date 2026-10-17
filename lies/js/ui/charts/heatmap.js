/* ============================================================
   js/ui/charts/heatmap.js
   GitHub-style heatmap using Jalali calendar.
   Confirmed imports are correct.
   ============================================================ */

import { getJalaliParts, jalaliToDate, jalaliMonthDays } from '../../utils/jalali.js';
import { toFaDigits } from '../../utils/format.js';
import { FA_WEEKDAYS_SHORT } from '../../config/constants.js';
import { showChartTooltip, hideChartTooltip } from './chart-utils.js';

/**
 * @param {{
 *   dataByDay: Record<string, number>,
 *   jy: number,
 *   jm: number,
 * }} opts
 * @returns {HTMLElement}
 */
export function heatmap(opts) {
  const { dataByDay = {}, jy, jm } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'heatmap';

  if (!jy || !jm) {
    wrap.textContent = 'داده‌ای موجود نیست';
    return wrap;
  }

  const daysInMonth = jalaliMonthDays(jy, jm);
  const firstDate = jalaliToDate(jy, jm, 1);
  const firstWeekday = firstDate ? getJalaliParts(firstDate).weekday : 0;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = jalaliToDate(jy, jm, d);
    const iso = date.toISOString().slice(0, 10);
    cells.push({
      day: d,
      iso,
      count: dataByDay[iso] || 0,
      date,
    });
  }

  const maxCount = Math.max(1, ...Object.values(dataByDay));
  const levels = [0, 0.15, 0.4, 0.7, 1];

  // Weekday header
  const header = document.createElement('div');
  header.className = 'heatmap__weekdays';
  for (const label of FA_WEEKDAYS_SHORT) {
    const c = document.createElement('span');
    c.className = 'heatmap__weekday';
    c.textContent = label;
    header.appendChild(c);
  }
  wrap.appendChild(header);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'heatmap__grid';
  grid.style.gridTemplateColumns = 'repeat(7, 1fr)';

  for (const cell of cells) {
    if (!cell) {
      const empty = document.createElement('div');
      empty.className = 'heatmap__cell heatmap__cell--empty';
      grid.appendChild(empty);
      continue;
    }

    const ratio = cell.count / maxCount;
    const level = levels.findIndex((l, i) => ratio <= l && (i === 0 || ratio > levels[i - 1]));
    const lvl = Math.max(0, level);

    const node = document.createElement('div');
    node.className = `heatmap__cell heatmap__cell--l${lvl}`;
    node.textContent = toFaDigits(cell.day);
    if (cell.count > 0) {
      node.classList.add('has-data');
      node.addEventListener('mouseenter', (ev) => {
        const rect = node.getBoundingClientRect();
        showChartTooltip(rect.left + rect.width / 2, rect.top, `
          <div class="chart-tooltip__label">${toFaDigits(cell.day)} ${cell.iso}</div>
          <div class="chart-tooltip__value">${toFaDigits(cell.count)} مورد</div>
        `);
      });
      node.addEventListener('mouseleave', hideChartTooltip);
    }

    grid.appendChild(node);
  }

  wrap.appendChild(grid);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'heatmap__legend';
  legend.innerHTML = `
    <span>کمتر</span>
    <span class="heatmap__swatch heatmap__cell--l0"></span>
    <span class="heatmap__swatch heatmap__cell--l1"></span>
    <span class="heatmap__swatch heatmap__cell--l2"></span>
    <span class="heatmap__swatch heatmap__cell--l3"></span>
    <span class="heatmap__swatch heatmap__cell--l4"></span>
    <span>بیشتر</span>
  `;
  wrap.appendChild(legend);

  return wrap;
}

export default { heatmap };