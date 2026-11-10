import { state } from '../state.js';
import { navigate } from '../router.js';
import { getCategory } from '../config.js';
import {
  esc, faDigits, fmtCompactMoney, fmtDurationShort,
  formatPersianDate, formatPersianWeekday, formatClock,
  todayISO, persianParts, persianToUTCDate, persianMonthLength,
  utcDateToISO, isoToUTCDate, PERSIAN_MONTHS, PERSIAN_WEEKDAYS_SHORT,
  sumBy,
} from '../utils.js';
import { emptyState } from '../ui.js';
import { openEntryDetail } from '../components/entry_modal.js';

export function render(container) {
  const entries = Array.isArray(state.entries) ? state.entries : [];
  if (!state.calendar) state.calendar = { year: null, month: null, selected: null };
  const cal = state.calendar;
  const today = persianParts(new Date());
  if (!cal.year) cal.year = today.y;
  if (!cal.month) cal.month = today.m;
  if (!cal.selected) cal.selected = todayISO();

  draw(container, entries, cal);
}

function draw(container, entries, cal) {
  const monthLength = persianMonthLength(cal.year, cal.month);
  const firstDate = persianToUTCDate(cal.year, cal.month, 1);
  const firstWeekday = (firstDate.getUTCDay() + 1) % 7;
  const todayParts = persianParts(new Date());
  const todayIso = todayISO();

  const byDate = entries.reduce((acc, e) => {
    if (!acc[e.entry_date]) acc[e.entry_date] = [];
    acc[e.entry_date].push(e);
    return acc;
  }, {});

  const maxDayCount = Math.max(1, ...Object.values(byDate).map((arr) => arr.length));

  let cells = '';
  for (let i = 0; i < firstWeekday; i += 1) {
    cells += `<div class="cal-day other-month"></div>`;
  }
  for (let d = 1; d <= monthLength; d += 1) {
    const iso = utcDateToISO(persianToUTCDate(cal.year, cal.month, d));
    const count = (byDate[iso] || []).length;
    const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxDayCount) * 4));
    const isToday = iso === todayIso;
    const isSelected = iso === cal.selected;
    cells += `
      <button type="button" class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${count ? 'has-joy' : ''}" data-date="${iso}" data-level="${level}">
        <span>${faDigits(d)}</span>
        ${count ? `<div class="cal-day-dots">${Array.from({ length: Math.min(count, 3) }, () => '<span class="cal-day-dot"></span>').join('')}</div>` : ''}
      </button>
    `;
  }
  const trailing = (7 - ((firstWeekday + monthLength) % 7)) % 7;
  for (let i = 0; i < trailing; i += 1) {
    cells += `<div class="cal-day other-month"></div>`;
  }

  const selectedEntries = byDate[cal.selected] || [];
  const monthTotal = entries.filter((e) => {
    const p = persianParts(isoToUTCDate(e.entry_date));
    return p.y === cal.year && p.m === cal.month;
  });
  const monthMoney = sumBy(monthTotal, (e) => e.money_spent);
  const monthTime = sumBy(monthTotal, (e) => e.time_spent_minutes);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">تقویم شادی</div>
        <div class="page-subtitle">${esc(PERSIAN_MONTHS[cal.month - 1])} ${faDigits(cal.year)} · ${faDigits(monthTotal.length)} شادی این ماه</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" data-goto="add">➕ شادی جدید</button>
      </div>
    </div>

    <div class="cal-toolbar">
      <div class="cal-title">${esc(PERSIAN_MONTHS[cal.month - 1])} ${faDigits(cal.year)}</div>
      <div class="cal-nav">
        <button type="button" class="icon-btn" data-cal="prev" aria-label="ماه قبل">›</button>
        <button type="button" class="btn btn-ghost btn-sm" data-cal="today">امروز</button>
        <button type="button" class="icon-btn" data-cal="next" aria-label="ماه بعد">‹</button>
      </div>
    </div>

    <div class="cal-grid">
      ${PERSIAN_WEEKDAYS_SHORT.map((d) => `<div class="cal-weekday">${esc(d)}</div>`).join('')}
      ${cells}
    </div>

    <div class="cal-legend">
      <span>کمتر</span>
      <span class="cal-legend-swatch" style="background:rgba(245,158,11,.15)"></span>
      <span class="cal-legend-swatch" style="background:rgba(245,158,11,.4)"></span>
      <span class="cal-legend-swatch" style="background:rgba(245,158,11,.7)"></span>
      <span class="cal-legend-swatch" style="background:rgba(245,158,11,.9)"></span>
      <span>بیشتر</span>
    </div>

    <div class="grid grid-2" style="margin-top:1.25rem">
      <div class="stat">
        <div class="stat-head">
          <div class="stat-label">هزینهٔ این ماه</div>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-value">${esc(fmtCompactMoney(monthMoney))}<span class="stat-unit">${esc(state.settings?.currency || 'تومان')}</span></div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-label">زمان برای خودت</div>
          <div class="stat-icon">⏳</div>
        </div>
        <div class="stat-value">${esc(fmtDurationShort(monthTime))}<span class="stat-unit"> این ماه</span></div>
      </div>
    </div>

    <div class="cal-day-panel anim-fade-up">
      <div class="cal-day-panel-head">
        <div>
          <div class="cal-day-panel-title">${esc(formatPersianWeekday(cal.selected))} ${esc(formatPersianDate(cal.selected))}</div>
          <div class="page-subtitle" style="font-size:.8rem">${faDigits(selectedEntries.length)} شادی ثبت‌شده</div>
        </div>
        <button type="button" class="btn btn-outline btn-sm" data-goto="add">➕ افزودن</button>
      </div>
      <div id="cal-day-entries">
        ${selectedEntries.length
          ? selectedEntries.map((e) => entryRow(e)).join('')
          : emptyState({ emoji: '🌼', title: 'این روز خالی است', desc: 'برای این روز شادی‌ای ثبت نکردی.', actionLabel: 'ثبت شادی', actionView: 'add' })}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-cal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.cal === 'prev') {
        cal.month -= 1;
        if (cal.month < 1) { cal.month = 12; cal.year -= 1; }
      } else if (btn.dataset.cal === 'next') {
        cal.month += 1;
        if (cal.month > 12) { cal.month = 1; cal.year += 1; }
      } else {
        cal.year = todayParts.y;
        cal.month = todayParts.m;
        cal.selected = todayIso;
      }
      draw(container, entries, cal);
    });
  });

  container.querySelectorAll('[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cal.selected = btn.dataset.date;
      draw(container, entries, cal);
    });
  });

  container.querySelectorAll('[data-entry-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = entries.find((e) => e.id === el.dataset.entryId);
      if (entry) openEntryDetail(entry);
    });
  });

  container.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
}

function entryRow(e) {
  const cat = getCategory(e.category);
  return `
    <div class="entry-mini" data-entry-id="${esc(e.id)}" role="button" tabindex="0">
      <div class="entry-mini-icon">${esc(e.emoji || cat.emoji)}</div>
      <div class="entry-mini-body">
        <div class="entry-mini-title">${esc(e.title)}</div>
        <div class="entry-mini-meta">
          <span>${esc(cat.label)}</span>
          ${e.entry_time ? `<span>·</span><span>${esc(formatClock(e.entry_time))}</span>` : ''}
          ${e.money_spent > 0 ? `<span>·</span><span>${esc(fmtCompactMoney(e.money_spent))}</span>` : ''}
          ${e.time_spent_minutes > 0 ? `<span>·</span><span>${esc(fmtDurationShort(e.time_spent_minutes))}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}
