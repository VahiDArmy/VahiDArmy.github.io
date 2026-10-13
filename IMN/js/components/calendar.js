/**
 * Jalali calendar / date-picker.
 *
 *   const cal = calendar({
 *     value: "2025-01-15", // ISO (Gregorian)
 *     onSelect: (iso) => pick(iso),
 *     markedDates: new Set(["2025-01-01", "2025-01-12"]),
 *   });
 *   parent.appendChild(cal.el);
 *
 * Displays the Persian calendar (Jalali) but always speaks ISO Gregorian
 * to the rest of the app so storage stays simple.
 */

import { createElement } from "../utils/dom.js";
import { icon } from "./icons.js";
import {
  todayISO, fromISO, toISO,
  toJalali, jalaliMonthLength,
  JALALI_MONTHS, JALALI_WEEKDAYS,
} from "../utils/date.js";

export function calendar(opts = {}) {
  const {
    value,
    onSelect,
    markedDates = new Set(),
    showFooter = true,
  } = opts;

  let selected = value || todayISO();
  let viewISO = selected;

  const el = createElement("div", { class: "calendar", role: "grid" });

  function render() {
    const jal = toJalali(viewISO);
    const jy = jal.year;
    const jm = jal.month;

    const firstIso = jalaliToISO(jy, jm, 1);
    const daysInMonth = jalaliMonthLength(jy, jm);

    // Gregorian weekday of the 1st (0=Sun … 6=Sat)
    const firstDow = fromISO(firstIso).getDay();
    // We display columns starting Saturday (Sat, Sun, Mon, ...)
    // Sat=6 → column 0, Sun=0 → column 1 … Fri=5 → column 6
    const startCol = (firstDow + 1) % 7;

    const cells = [];
    for (let i = 0; i < startCol; i++) cells.push({ muted: true });

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = jalaliToISO(jy, jm, d);
      cells.push({
        day: d,
        iso,
        isToday: iso === todayISO(),
        isSelected: iso === selected,
        hasEvent: markedDates.has(iso),
        muted: false,
      });
    }

    // Fill remaining cells for a 6-row grid so height is stable
    while (cells.length < 42) cells.push({ muted: true });

    el.innerHTML = `
      <div class="calendar__header">
        <button class="calendar__nav-btn" data-nav="prev" type="button" aria-label="ماه قبل">${icon("chevronRight", { size: 16 })}</button>
        <div class="calendar__title">${JALALI_MONTHS[jm - 1]} ${jy}</div>
        <button class="calendar__nav-btn" data-nav="next" type="button" aria-label="ماه بعد">${icon("chevronLeft", { size: 16 })}</button>
      </div>
      <div class="calendar__grid">
        ${JALALI_WEEKDAYS.map((w) => `<div class="calendar__dow">${w.slice(0, 1)}</div>`).join("")}
        ${cells.map((c, i) => {
          if (c.muted) return `<div class="calendar__day is-muted"></div>`;
          const cls = [
            "calendar__day",
            c.isToday ? "is-today" : "",
            c.isSelected ? "is-selected" : "",
            c.hasEvent ? "has-event" : "",
          ].filter(Boolean).join(" ");
          return `<div class="${cls}" data-iso="${c.iso}" role="gridcell">${c.day}</div>`;
        }).join("")}
      </div>
      ${showFooter ? `
        <div class="calendar__footer">
          <button class="btn btn--ghost" type="button" data-action="today">امروز</button>
          <button class="btn btn--ghost" type="button" data-action="clear">پاک کردن</button>
        </div>
      ` : ""}
    `;

    el.querySelector('[data-nav="prev"]').addEventListener("click", () => shiftMonth(-1));
    el.querySelector('[data-nav="next"]').addEventListener("click", () => shiftMonth(1));
    el.querySelectorAll(".calendar__day[data-iso]").forEach((cell) => {
      cell.addEventListener("click", () => {
        selected = cell.dataset.iso;
        viewISO = selected;
        render();
        onSelect?.(selected);
      });
    });
    if (showFooter) {
      el.querySelector('[data-action="today"]').addEventListener("click", () => {
        selected = todayISO();
        viewISO = selected;
        render();
        onSelect?.(selected);
      });
      el.querySelector('[data-action="clear"]').addEventListener("click", () => {
        selected = "";
        render();
        onSelect?.(null);
      });
    }
  }

  function shiftMonth(delta) {
    const jal = toJalali(viewISO);
    let jm = jal.month + delta;
    let jy = jal.year;
    while (jm > 12) { jm -= 12; jy += 1; }
    while (jm < 1) { jm += 12; jy -= 1; }
    viewISO = jalaliToISO(jy, jm, 1);
    render();
  }

  render();

  return {
    el,
    get value() { return selected; },
    set(iso) {
      selected = iso || "";
      viewISO = selected || todayISO();
      render();
    },
    refreshMarks(set) {
      markedDates.clear();
      set.forEach((d) => markedDates.add(d));
      render();
    },
  };
}

/* ---------- Jalali → ISO ----------------------------------------------- */
/* Uses the same jalaali-js algorithm implemented in utils/date.js.
   We inline the conversion here to keep the calendar module self-contained
   and avoid round-tripping through format functions. */
function jalaliToISO(jy, jm, jd) {
  const g = jalaliToGregorian(jy, jm, jd);
  return toISO(new Date(g.gy, g.gm - 1, g.gd));
}

function jalaliToGregorian(jy, jm, jd) {
  let gy = jy + 621;
  let leapJ = -14;
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm2 = breaks[i];
    jump = jm2 - jp;
    if (jy < jm2) break;
    leapJ = leapJ + Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = jm2;
  }
  let n = jy - jp;
  leapJ = leapJ + Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;

  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + Math.floor((jump + 4) / 33) * 33;
  let leap = ((n + 1) % 33 - 1) % 4;
  if (leap === -1) leap = 4;

  let days = 0;
  if (jm <= 7) {
    days = (jm - 1) * 31;
  } else {
    days = (jm - 7) * 30 + 186;
  }
  days += jd;

  let gDayNo = days + march - 1;
  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const gy2 = gy + 1;
  if (gDayNo >= 365 + (isGLeap(gy) ? 1 : 0)) {
    gDayNo -= 365 + (isGLeap(gy) ? 1 : 0);
    gy += 1;
  }
  let gm = 1;
  while (gm <= 12) {
    const dim = gDaysInMonth[gm - 1] + (gm === 2 && isGLeap(gy) ? 1 : 0);
    if (gDayNo < dim) break;
    gDayNo -= dim;
    gm += 1;
  }
  const gd = gDayNo + 1;
  return { gy, gm, gd };
}

function isGLeap(gy) {
  return gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
}

/**
 * Attach a calendar to an input-like trigger.
 *   attachPicker(triggerEl, { onSelect });
 */
export function attachPicker(trigger, opts = {}) {
  let cal = null;
  function toggle(e) {
    e?.stopPropagation();
    if (cal) { cal.el.remove(); cal = null; return; }
    cal = calendar(opts);
    document.body.appendChild(cal.el);
    const r = trigger.getBoundingClientRect();
    cal.el.style.position = "fixed";
    cal.el.style.top = `${r.bottom + 6}px`;
    cal.el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 320))}px`;
    cal.el.style.zIndex = "500";
    const off = (ev) => {
      if (!cal) return;
      if (!cal.el.contains(ev.target) && !trigger.contains(ev.target)) {
        cal.el.remove();
        cal = null;
        document.removeEventListener("mousedown", off);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", off));
  }
  trigger.addEventListener("click", toggle);
  return () => trigger.removeEventListener("click", toggle);
}