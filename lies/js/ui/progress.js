/* ============================================================
   js/ui/progress.js
   Progress bar + circular + ring
   ============================================================ */

import { el } from '../utils/dom.js';

/**
 * @param {{
 *   value: number,         // 0..1
 *   max?: number,
 *   label?: string,
 *   showValue?: boolean,
 *   size?: 'xs'|'sm'|'md'|'lg',
 *   variant?: 'default'|'accent'|'success'|'warning'|'danger',
 *   striped?: boolean,
 *   animated?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function progressBar(opts = {}) {
  const {
    value = 0, max = 1, label = '',
    showValue = false, size = 'md', variant = 'default',
    striped = false, animated = false,
  } = opts;

  const pct = Math.max(0, Math.min(1, Number(value) / max));

  const wrap = el('div', { class: ['progress-wrap', `progress-wrap--${size}`] });
  if (label) wrap.appendChild(el('div', { class: 'progress-wrap__label' }, { children: [label] }));

  const track = el('div', {
    class: ['progress', `progress--${size}`, `progress--${variant}`, striped ? 'progress--striped' : '', animated ? 'progress--animated' : ''].filter(Boolean),
    attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(value) },
  });
  const bar = el('div', { class: 'progress__bar', style: { width: `${pct * 100}%` } });
  track.appendChild(bar);
  wrap.appendChild(track);

  if (showValue) {
    wrap.appendChild(el('div', { class: 'progress-wrap__value' }, { children: [`${Math.round(pct * 100)}٪`] }));
  }

  wrap._progress = {
    set(v) {
      const p = Math.max(0, Math.min(1, Number(v) / max));
      bar.style.width = `${p * 100}%`;
      track.setAttribute('aria-valuenow', String(v));
    },
  };

  return wrap;
}

/**
 * Circular progress (SVG).
 * @param {{
 *   value: number,   // 0..1
 *   size?: number,
 *   thickness?: number,
 *   label?: string,
 *   variant?: string,
 * }} opts
 * @returns {HTMLElement}
 */
export function progressRing(opts = {}) {
  const { value = 0, size = 88, thickness = 8, label = '', variant = 'accent' } = opts;
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  const wrap = el('div', { class: ['progress-ring', `progress-ring--${variant}`] });
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  const bg = document.createElementNS(NS, 'circle');
  bg.setAttribute('cx', String(size / 2));
  bg.setAttribute('cy', String(size / 2));
  bg.setAttribute('r', String(r));
  bg.setAttribute('class', 'progress-ring__bg');
  bg.setAttribute('stroke-width', String(thickness));
  bg.setAttribute('fill', 'none');

  const fg = document.createElementNS(NS, 'circle');
  fg.setAttribute('cx', String(size / 2));
  fg.setAttribute('cy', String(size / 2));
  fg.setAttribute('r', String(r));
  fg.setAttribute('class', 'progress-ring__fg');
  fg.setAttribute('stroke-width', String(thickness));
  fg.setAttribute('fill', 'none');
  fg.setAttribute('stroke-dasharray', String(c));
  fg.setAttribute('stroke-dashoffset', String(offset));
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);

  svg.appendChild(bg);
  svg.appendChild(fg);
  wrap.appendChild(svg);

  wrap.appendChild(el('div', { class: 'progress-ring__value' }, {
    children: [label || `${Math.round(pct * 100)}٪`],
  }));

  return wrap;
}

export default { progressBar, progressRing };