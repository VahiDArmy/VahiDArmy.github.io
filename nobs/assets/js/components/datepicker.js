/* ==========================================================================
   datepicker.js — ورودی تاریخ شمسی با تقویم بازشو
   ========================================================================== */

import { icon } from '../lib/icons.js';
import { esc, faNum, todayISO } from '../lib/utils.js';
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  formatJalali,
  isoFromJalali,
  jalaliFromISO,
  jalaliMonthLength,
  jalaliWeekdayIndex,
} from '../lib/jalali.js';

export function createDateInput({ value = todayISO(), onChange = null, hint = 'تغییر' } = {}) {
  let current = value || todayISO();
  const initial = jalaliFromISO(current);
  let viewYear = initial.jy;
  let viewMonth = initial.jm;
  let open = false;

  const wrap = document.createElement('div');
  wrap.className = 'dp-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'dp-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');

  const pop = document.createElement('div');
  pop.className = 'dp';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'انتخاب تاریخ شمسی');
  pop.hidden = true;

  wrap.append(trigger, pop);

  function renderTrigger() {
    trigger.innerHTML = `${icon('calendar', 15)}
      <span class="dp-trigger__value">${esc(formatJalali(current, 'full'))}</span>
      <span class="dp-trigger__hint">${esc(hint)}</span>`;
  }

  function selectDay(jd) {
    current = isoFromJalali(viewYear, viewMonth, jd);
    renderTrigger();
    onChange?.(current);
    close();
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth > 12) {
      viewMonth = 1;
      viewYear += 1;
    } else if (viewMonth < 1) {
      viewMonth = 12;
      viewYear -= 1;
    }
    renderCalendar();
  }

  function renderCalendar() {
    const length = jalaliMonthLength(viewYear, viewMonth);
    const firstISO = isoFromJalali(viewYear, viewMonth, 1);
    const firstWeekday = jalaliWeekdayIndex(firstISO);
    const selected = jalaliFromISO(current);
    const today = jalaliFromISO(todayISO());

    const days = [];
    for (let i = 0; i < firstWeekday; i += 1) days.push('<span class="dp__day is-out" aria-hidden="true"></span>');
    for (let day = 1; day <= length; day += 1) {
      const isSelected = selected.jy === viewYear && selected.jm === viewMonth && selected.jd === day;
      const isToday = today.jy === viewYear && today.jm === viewMonth && today.jd === day;
      days.push(`<button type="button" class="dp__day ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}"
        data-day="${day}" aria-label="${day} ${JALALI_MONTHS[viewMonth - 1]}">${faNum(day)}</button>`);
    }

    pop.innerHTML = `
      <div class="dp__head">
        <span class="dp__title">${esc(JALALI_MONTHS[viewMonth - 1])} ${faNum(viewYear)}</span>
        <div class="dp__nav">
          <button type="button" class="dp__nav-btn" data-dp-nav="-1" aria-label="ماه قبل">${icon('chevron-right', 13)}</button>
          <button type="button" class="dp__nav-btn" data-dp-nav="1" aria-label="ماه بعد">${icon('chevron-left', 13)}</button>
        </div>
      </div>
      <div class="dp__weekdays">${JALALI_WEEKDAYS_SHORT.map((d) => `<span class="dp__wd">${d}</span>`).join('')}</div>
      <div class="dp__grid">${days.join('')}</div>
      <div class="dp__foot">
        <button type="button" class="dp__quick" data-dp-quick="today">امروز</button>
        <button type="button" class="dp__quick" data-dp-quick="yesterday">دیروز</button>
        <button type="button" class="dp__quick" data-dp-quick="week">هفت روز پیش</button>
      </div>
    `;
  }

  function openCalendar() {
    if (open) return;
    open = true;
    const j = jalaliFromISO(current);
    viewYear = j.jy;
    viewMonth = j.jm;
    renderCalendar();
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    pop.classList.add('is-open');
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onEscape);
  }

  function close() {
    if (!open) return;
    open = false;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onEscape);
  }

  function onOutside(event) {
    if (!wrap.contains(event.target)) close();
  }

  function onEscape(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  trigger.addEventListener('click', () => (open ? close() : openCalendar()));

  pop.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-dp-nav]');
    if (nav) {
      shiftMonth(Number(nav.dataset.dpNav));
      return;
    }
    const day = event.target.closest('[data-day]');
    if (day) {
      selectDay(Number(day.dataset.day));
      return;
    }
    const quick = event.target.closest('[data-dp-quick]');
    if (quick) {
      const mode = quick.dataset.dpQuick;
      if (mode === 'today') current = todayISO();
      else if (mode === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const pad = (n) => String(n).padStart(2, '0');
        current = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      } else {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const pad = (n) => String(n).padStart(2, '0');
        current = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      renderTrigger();
      onChange?.(current);
      close();
    }
  });

  renderTrigger();

  return {
    el: wrap,
    getValue: () => current,
    setValue: (iso) => {
      current = iso || todayISO();
      renderTrigger();
      if (open) renderCalendar();
    },
    destroy: () => close(),
  };
}
