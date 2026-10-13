/**
 * Jalali calendar / date-picker.
 *
 * Displays the Persian calendar but always speaks ISO Gregorian to the
 * rest of the app. All conversions live in `utils/date.js` (jalaali-js,
 * well-tested) to avoid divergence from other date formatting code.
 */

import { createElement } from "../utils/dom.js";
import { icon } from "./icons.js";
import {
  todayISO, fromISO, toISO,
  toJalali, jalaliToISO, jalaliMonthLength,
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

    // Gregorian weekday of the 1st of the Jalali month (0=Sun … 6=Sat)
    const firstDow = fromISO(firstIso).getDay();
    // Display columns starting Saturday
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
    while (cells.length < 42) cells.push({ muted: true });

    el.innerHTML = `
      <div class="calendar__header">
        <button class="calendar__nav-btn" data-nav="prev" type="button" aria-label="ماه قبل">${icon("chevronRight", { size: 16 })}</button>
        <div class="calendar__title">${JALALI_MONTHS[jm - 1]} ${jy}</div>
        <button class="calendar__nav-btn" data-nav="next" type="button" aria-label="ماه بعد">${icon("chevronLeft", { size: 16 })}</button>
      </div>
      <div class="calendar__grid">
        ${JALALI_WEEKDAYS.map((w) => `<div class="calendar__dow">${w.slice(0, 1)}</div>`).join("")}
        ${cells.map((c) => {
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

/**
 * Attach a calendar popover to a trigger element.
 * Returns a detach function.
 */
export function attachPicker(trigger, opts = {}) {
  let cal = null;
  let detachOutside = null;

  function close() {
    if (!cal) return;
    cal.el.remove();
    cal = null;
    if (detachOutside) {
      document.removeEventListener("mousedown", detachOutside, true);
      detachOutside = null;
    }
  }

  function toggle(e) {
    e?.stopPropagation();
    if (cal) return close();

    cal = calendar({
      ...opts,
      onSelect: (iso) => {
        opts.onSelect?.(iso);
        close();
      },
    });
    document.body.appendChild(cal.el);

    const r = trigger.getBoundingClientRect();
    cal.el.style.position = "fixed";
    cal.el.style.top = `${r.bottom + 6}px`;
    cal.el.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 320))}px`;
    cal.el.style.zIndex = "500";

    detachOutside = (ev) => {
      if (!cal) return;
      if (!cal.el.contains(ev.target) && !trigger.contains(ev.target)) close();
    };
    // Defer so the click that opened the popover doesn't also close it
    setTimeout(() => document.addEventListener("mousedown", detachOutside, true), 0);
  }

  trigger.addEventListener("click", toggle);

  return function detach() {
    trigger.removeEventListener("click", toggle);
    close();
  };
}