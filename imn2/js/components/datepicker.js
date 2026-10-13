/**
 * datepicker.js — انتخابگر تاریخ شمسی
 * API: openDatePicker({ anchor, value, onSelect, min, max })
 */

import { el, clear, rectOf, lockScroll, unlockScroll } from '../utils/dom.js';
import {
  JALALI_MONTHS, JALALI_WEEKDAYS_SHORT,
  isoToJalali, jalaliToISO, jalaliMonthMatrix,
  todayISO, isToday, daysInJalaliMonth,
} from '../utils/date.js';

let current = null;

function closeCurrent() {
  if (current) { current.close(); current = null; }
}

/* =========================================================================
   Open
   ========================================================================= */

export function openDatePicker({
  anchor,
  value = todayISO(),
  onSelect,
  min = null,
  max = null,
  weekStartsSaturday = true,
} = {}) {
  closeCurrent();

  let { jy, jm } = isoToJalali(value);
  let view = 'days'; // days | months | years
  let yearPage = Math.floor(jy / 12) * 12;

  const root = document.getElementById('dropdown-root') || document.body;

  const panel = el('div', { class: 'datepicker', role: 'dialog', 'aria-modal': 'true' });
  root.appendChild(panel);
  lockScroll();

  /* ---------- Header ---------- */
  const header = el('div', { class: 'datepicker__header' });
  const prevBtn = el('button', { class: 'datepicker__nav', type: 'button', 'aria-label': 'قبلی' }, ['‹']);
  const monthTitle = el('button', { class: 'datepicker__month', type: 'button', style: { background: 'transparent', border: 'none' } });
  const nextBtn = el('button', { class: 'datepicker__nav', type: 'button', 'aria-label': 'بعدی' }, ['›']);
  header.appendChild(prevBtn);
  header.appendChild(monthTitle);
  header.appendChild(nextBtn);
  panel.appendChild(header);

  /* ---------- Weekdays ---------- */
  const weekdaysRow = el('div', { class: 'datepicker__weekdays' });
  const days = weekStartsSaturday ? JALALI_WEEKDAYS_SHORT : [...JALALI_WEEKDAYS_SHORT.slice(1), JALALI_WEEKDAYS_SHORT[0]];
  days.forEach((d) => weekdaysRow.appendChild(el('span', { class: 'datepicker__weekday' }, [d])));
  panel.appendChild(weekdaysRow);

  /* ---------- Body ---------- */
  const bodyContainer = el('div');
  panel.appendChild(bodyContainer);

  /* ---------- Footer ---------- */
  const footer = el('div', { class: 'datepicker__footer' });
  const todayBtn = el('button', { class: 'btn btn--ghost', type: 'button' }, ['امروز']);
  const closeBtn = el('button', { class: 'btn btn--outline', type: 'button' }, ['بستن']);
  footer.appendChild(todayBtn);
  footer.appendChild(closeBtn);
  panel.appendChild(footer);

  /* ---------- Events ---------- */
  todayBtn.addEventListener('click', () => {
    onSelect?.(todayISO());
    close();
  });
  closeBtn.addEventListener('click', close);

  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));
  monthTitle.addEventListener('click', () => {
    view = view === 'days' ? 'months' : 'days';
    render();
  });

  function navigate(dir) {
    if (view === 'days') {
      jm += dir;
      if (jm > 12) { jm = 1; jy++; }
      if (jm < 1) { jm = 12; jy--; }
    } else if (view === 'months') {
      jy += dir;
    } else if (view === 'years') {
      yearPage += dir * 12;
    }
    render();
  }

  /* ---------- Render ---------- */
  function render() {
    clear(bodyContainer);

    if (view === 'days') {
      monthTitle.textContent = `${JALALI_MONTHS[jm - 1]} ${jy}`;
      prevBtn.style.display = '';
      nextBtn.style.display = '';

      const grid = el('div', { class: 'datepicker__days' });
      const cells = jalaliMonthMatrix(jy, jm, weekStartsSaturday);
      for (const c of cells) {
        const cell = el('button', {
          class: [
            'datepicker__day',
            c.isOutside ? 'is-outside' : '',
            isToday(c.iso) ? 'is-today' : '',
            c.iso === value ? 'is-selected' : '',
            isOutOfRange(c.iso) ? 'is-disabled' : '',
          ].filter(Boolean).join(' '),
          type: 'button',
        }, [toFa(c.jd)]);
        cell.addEventListener('click', () => {
          if (isOutOfRange(c.iso)) return;
          value = c.iso;
          onSelect?.(c.iso);
          close();
        });
        grid.appendChild(cell);
      }
      bodyContainer.appendChild(grid);
    } else if (view === 'months') {
      monthTitle.textContent = `${jy}`;
      prevBtn.style.display = '';
      nextBtn.style.display = '';
      const grid = el('div', { class: 'datepicker__picker' });
      JALALI_MONTHS.forEach((name, idx) => {
        const item = el('button', {
          class: `datepicker__picker-item ${(idx + 1) === jm ? 'is-active' : ''}`,
          type: 'button',
        }, [name]);
        item.addEventListener('click', () => { jm = idx + 1; view = 'days'; render(); });
        grid.appendChild(item);
      });
      bodyContainer.appendChild(grid);
    } else {
      monthTitle.textContent = `${yearPage} - ${yearPage + 11}`;
      const grid = el('div', { class: 'datepicker__picker' });
      for (let i = 0; i < 12; i++) {
        const y = yearPage + i;
        const item = el('button', {
          class: `datepicker__picker-item ${y === jy ? 'is-active' : ''}`,
          type: 'button',
        }, [toFa(y)]);
        item.addEventListener('click', () => { jy = y; view = 'months'; render(); });
        grid.appendChild(item);
      }
      bodyContainer.appendChild(grid);
    }
  }

  function isOutOfRange(iso) {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  render();

  /* ---------- Position ---------- */
  requestAnimationFrame(() => {
    if (!anchor) return;
    const r = rectOf(anchor);
    const mr = rectOf(panel);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left;
    let top = r.bottom + 6;

    if (left + mr.width > vw - 8) left = vw - mr.width - 8;
    if (left < 8) left = 8;
    if (top + mr.height > vh - 8) {
      const above = r.top - mr.height - 6;
      top = above > 8 ? above : Math.max(8, vh - mr.height - 8);
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  });

  /* ---------- Outside ---------- */
  function onDocClick(e) {
    if (panel.contains(e.target)) return;
    if (anchor && anchor.contains(e.target)) return;
    close();
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }

  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
  }, 0);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
    unlockScroll();
    panel.remove();
    if (current?.close === close) current = null;
  }

  current = { close };
  return { close };
}

/* ---------- Helper ---------- */

function toFa(n) {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

export const datepicker = { open: openDatePicker, close: closeCurrent };