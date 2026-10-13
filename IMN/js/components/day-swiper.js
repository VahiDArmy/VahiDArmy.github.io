/**
 * Day Swiper — horizontal strip of day chips under the topbar.
 *
 * Centering — how this works and why it's reliable
 * ------------------------------------------------
 * We use `Element.scrollIntoView({ block: "nearest", inline: "center" })`.
 *
 *   • `inline: "center"` centers the chip horizontally inside its
 *     nearest scroll container (the strip). Browsers handle RTL natively,
 *     so we don't have to compute scrollLeft math ourselves.
 *
 *   • `block: "nearest"` means "don't scroll vertically unless the
 *     element is off-screen vertically". Since the chip is inside a
 *     sticky bar at the top of the viewport, no vertical scroll happens.
 *     This is the correct option to avoid the page jumping.
 *
 * Range
 * -----
 * The strip is built ±30 days around the currently selected date — 61
 * chips total. That guarantees there's always enough content for the
 * strip to scroll, so centering always works, on any viewport size.
 *
 * On first mount the selected date is today, so today's chip is centered
 * and highlighted with the gradient pill.
 *
 * Public API:
 *   const swiper = mountDaySwiper(container, { date, onChange });
 *   swiper.setDate(iso);
 *   swiper.scrollToToday();
 *   swiper.destroy();
 */

import { delegate } from "../utils/dom.js";
import {
  todayISO, addDays, formatWeekdayShort, toJalali, isToday,
  JALALI_MONTHS,
} from "../utils/date.js";

const DAYS_BEFORE = 30;
const DAYS_AFTER  = 30;

function buildChips(centerISO) {
  const chips = [];
  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    chips.push(addDays(centerISO, i));
  }
  return chips;
}

export function mountDaySwiper(container, opts = {}) {
  const { date: initialDate, onChange } = opts;

  let selected = initialDate || todayISO();
  let dataSet = new Set();

  container.innerHTML = `<div class="day-swiper" role="tablist" aria-label="انتخاب روز"></div>`;
  const strip = container.querySelector(".day-swiper");

  /* ---------- Render -------------------------------------------------- */

  function render() {
    const today = todayISO();
    const chips = buildChips(selected);

    strip.innerHTML = chips.map((iso) => {
      const jal = toJalali(iso);
      const isSel = iso === selected;
      const isTod = isToday(iso);
      const isFut = iso > today;
      const hasData = dataSet.has(iso);
      const weekday = formatWeekdayShort(iso).slice(0, 3);
      const monthLabel = JALALI_MONTHS[jal.month - 1]?.slice(0, 3) || "";

      const cls = [
        "day-chip",
        isSel ? "is-selected" : "",
        isTod ? "is-today" : "",
        isFut ? "is-future" : "",
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

    // Center the selected chip after the browser lays out the new chips.
    // Two rAFs are enough for the DOM + fonts to settle.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sel = strip.querySelector(".day-chip.is-selected");
        if (!sel) return;
        try {
          sel.scrollIntoView({
            block: "nearest",
            inline: "center",
            behavior: "auto",   // instant — no smooth animation to interrupt
          });
        } catch {
          // Older browsers that don't support the options object —
          // fall back to the default behaviour which still scrolls it
          // into view.
          sel.scrollIntoView();
        }
      });
    });
  }

  /* ---------- Interaction -------------------------------------------- */

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

  /* ---------- Midnight watcher ---------------------------------------- */

  let midnightTimer = null;
  function scheduleMidnightRefresh() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 1, 0, 0);
    const delay = Math.max(30 * 1000, next - now);
    midnightTimer = setTimeout(() => {
      render();
      scheduleMidnightRefresh();
    }, delay);
  }
  scheduleMidnightRefresh();

  render();

  /* ---------- Public API ---------------------------------------------- */

  return {
    setDate(iso, { silent = true } = {}) {
      if (!iso) return;
      if (iso === selected) {
        // Same date — but strip may have been scrolled by the user;
        // re-center it.
        const sel = strip.querySelector(".day-chip.is-selected");
        if (sel) {
          try {
            sel.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
          } catch {
            sel.scrollIntoView();
          }
        }
        return;
      }
      selected = iso;
      render();
      if (!silent) onChange?.(iso);
    },

    scrollToToday({ silent = false } = {}) {
      const today = todayISO();
      const changed = selected !== today;
      selected = today;
      render();
      if (changed && !silent) onChange?.(today);
    },

    refreshData(datesArray) {
      dataSet = new Set(datesArray || []);
      // Just update classes — no need to re-render the whole strip.
      strip.querySelectorAll(".day-chip").forEach((el) => {
        el.classList.toggle("has-data", dataSet.has(el.dataset.iso));
      });
    },

    get date() { return selected; },

    destroy() {
      if (midnightTimer) clearTimeout(midnightTimer);
      container.innerHTML = "";
    },
  };
}