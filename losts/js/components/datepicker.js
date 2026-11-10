import { openModal } from '../ui.js';
import { persianParts, persianToUTCDate, utcDateToISO, isoToUTCDate, formatPersianDate, PERSIAN_MONTHS, faDigits } from '../utils.js';

export function openShamsiDatepicker(initialIso, onSelect) {
  let currentParts = persianParts(initialIso ? isoToUTCDate(initialIso) : new Date());
  let selectedIso = initialIso || utcDateToISO(new Date());
  let viewYear = currentParts.y;
  let viewMonth = currentParts.m;

  const body = document.createElement('div');
  body.className = 'shamsi-datepicker';

  const render = () => {
    const monthLength = getMonthLength(viewYear, viewMonth);
    const firstDate = persianToUTCDate(viewYear, viewMonth, 1);
    const firstWeekday = (firstDate.getUTCDay() + 1) % 7; // 0 = Saturday

    let cells = '';
    for (let i = 0; i < firstWeekday; i++) {
      cells += `<div class="sdp-day empty"></div>`;
    }
    for (let d = 1; d <= monthLength; d++) {
      const iso = utcDateToISO(persianToUTCDate(viewYear, viewMonth, d));
      const isSelected = iso === selectedIso;
      const isToday = iso === utcDateToISO(new Date());
      cells += `
        <button type="button" class="sdp-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-iso="${iso}">
          ${faDigits(d)}
        </button>
      `;
    }

    body.innerHTML = `
      <div class="sdp-header">
        <button type="button" class="sdp-nav" data-nav="prev-year">‹‹</button>
        <button type="button" class="sdp-nav" data-nav="prev-month">‹</button>
        <div class="sdp-title">${PERSIAN_MONTHS[viewMonth - 1]} ${faDigits(viewYear)}</div>
        <button type="button" class="sdp-nav" data-nav="next-month">›</button>
        <button type="button" class="sdp-nav" data-nav="next-year">››</button>
      </div>
      <div class="sdp-weekdays">
        <span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span>
      </div>
      <div class="sdp-grid">
        ${cells}
      </div>
    `;
  };

  const handle = openModal({
    title: 'انتخاب تاریخ',
    body: body,
    size: 'sm',
    onMount: (m) => {
      const clickHandler = (e) => {
        const nav = e.target.closest('[data-nav]');
        if (nav) {
          if (nav.dataset.nav === 'prev-month') { viewMonth--; if (viewMonth < 1) { viewMonth = 12; viewYear--; } }
          if (nav.dataset.nav === 'next-month') { viewMonth++; if (viewMonth > 12) { viewMonth = 1; viewYear++; } }
          if (nav.dataset.nav === 'prev-year') { viewYear--; }
          if (nav.dataset.nav === 'next-year') { viewYear++; }
          render();
          return;
        }
        const dayBtn = e.target.closest('[data-iso]');
        if (dayBtn) {
          selectedIso = dayBtn.dataset.iso;
          if (typeof onSelect === 'function') onSelect(selectedIso);
          m.close();
        }
      };
      
      m.el.querySelector('.modal-body').addEventListener('click', clickHandler);
      render();
    }
  });
}

function getMonthLength(py, pm) {
  const start = persianToUTCDate(py, pm, 1);
  let nextY = py;
  let nextM = pm + 1;
  if (nextM > 12) { nextM = 1; nextY += 1; }
  const next = persianToUTCDate(nextY, nextM, 1);
  return Math.round((next - start) / 86400000);
}
