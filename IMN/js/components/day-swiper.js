/**
 * Day Swiper — a horizontal strip of day chips under the topbar.
 *
 * Public API:
 *   const swiper = mountDaySwiper(container, {
 *     date: "2025-01-15",
 *     onChange: (iso) => { ... },     // called with the picked ISO date
 *     hasDataFor: (iso) => boolean,   // optional, marks days with data
 *   });
 *   swiper.setDate("2025-01-20");
 *   swiper.destroy();
 */

import { delegate } from "../utils/dom.js";
import {
  todayISO, addDays, fromISO, formatWeekdayShort, toJalali, isToday,
} from "../utils/date.js";
import { JALALI_MONTHS } from "../utils/date.js";

const DAYS_BEFORE = 14;
const DAYS_AFTER = 7;

function buildChips(centerISO) {
  const chips = [];
  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    chips.push(addDays(centerISO, i));
  }
  return chips;
}

export function mountDaySwiper(container, opts = {}) {
  const { date: initialDate, onChange, hasDataFor } = opts;
  const today = todayISO();

  let selected = initialDate || today;
  let dataSet = new Set();

  container.innerHTML = `<div class="day-swiper" role="tablist" aria-label="انتخاب روز"></div>`;
  const strip = container.querySelector(".day-swiper");

  function render() {
    const chips = buildChips(selected);
    strip.innerHTML = chips.map((iso) => {
      const jal = toJalali(iso);
      const isSel = iso === selected;
      const isTod = isToday(iso);
      const isFuture = iso > today;
      const hasData = dataSet.has(iso);
      const weekday = formatWeekdayShort(iso).slice(0, 3);
      const monthLabel = JALALI_MONTHS[jal.month - 1]?.slice(0, 3) || "";

      const cls = [
        "day-chip",
        isSel ? "is-selected" : "",
        isTod ? "is-today" : "",
        isFuture ? "is-future" : "",
        hasData ? "has-data" : "",
      ].filter(Boolean).join(" ");

      return `
        <div class="${cls}" data-iso="${iso}" role="tab"
             aria-selected="${isSel}"
             tabindex="${isSel ? 0 : -1}"
             title="${jal.day} ${monthLabel} ${jal.year}">
          <div class="day-chip__weekday">${weekday}</div>
          <div class="day-chip__day">${jal.day}</div>
          <div class="day-chip__month">${monthLabel}</div>
        </div>
      `;
    }).join("");

    // Scroll the selected chip into view (center)
    requestAnimationFrame(() => {
      const sel = strip.querySelector(".day-chip.is-selected");
      if (sel) {
        sel.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    });
  }

  function selectDate(iso) {
    if (!iso || iso === selected) return;
    selected = iso;
    render();
    onChange?.(iso);
  }

  delegate(strip, "click", ".day-chip", (e, chip) => {
    if (chip.classList.contains("is-future")) return;
    selectDate(chip.dataset.iso);
  });

  // Swipe gesture: horizontal drag shifts the window
  let pointerDown = false;
  let startX = 0;
  strip.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    startX = e.clientX;
  });
  strip.addEventListener("pointerup", (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = e.clientX - startX;
    const threshold = 60;
    if (dx > threshold) selectDate(addDays(selected, -1));
    else if (dx < -threshold) selectDate(addDays(selected, 1));
  });
  strip.addEventListener("pointercancel", () => (pointerDown = false));

  render();

  return {
    setDate(iso, { silent = true } = {}) {
      if (!iso || iso === selected) return;
      selected = iso;
      render();
      if (!silent) onChange?.(iso);
    },
    refreshData(datesArray) {
      dataSet = new Set(datesArray || []);
      render();
    },
    get date() { return selected; },
    destroy() {
      container.innerHTML = "";
    },
  };
}