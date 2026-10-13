/**
 * Day Swiper — a horizontal strip of day chips under the topbar.
 *
 * Fixes
 * -----
 *   • `today` is now resolved on every render (previously it was captured
 *     once at mount time, so a tab left open across midnight would keep
 *     showing yesterday as "today").
 *   • The selected chip is centered using `scrollLeft` instead of
 *     `scrollIntoView`. `scrollIntoView({ inline: "center" })` also
 *     scrolls the *page* vertically in some browsers, which is why the
 *     strip would sometimes appear to jump or miss the target.
 *   • Added `scrollToToday()` so app.js can force the strip back to
 *     today whenever the app boots or the user picks "امروز" elsewhere.
 *   • Layout is measured with a small `requestAnimationFrame` chain so
 *     centering happens after the chips have real dimensions.
 *
 * Public API:
 *   const swiper = mountDaySwiper(container, {
 *     date: "2025-01-15",
 *     onChange: (iso) => { ... },
 *     hasDataFor: (iso) => boolean,  // optional
 *   });
 *   swiper.setDate("2025-01-20");
 *   swiper.scrollToToday();
 *   swiper.destroy();
 */

import { delegate } from "../utils/dom.js";
import {
  todayISO, addDays, formatWeekdayShort, toJalali, isToday,
  JALALI_MONTHS,
} from "../utils/date.js";

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

  // Always start on today if no explicit date was passed.
  let selected = initialDate || todayISO();
  let dataSet = new Set();

  container.innerHTML = `<div class="day-swiper" role="tablist" aria-label="انتخاب روز"></div>`;
  const strip = container.querySelector(".day-swiper");

  /* ---------- Rendering ------------------------------------------------ */

  function render({ scroll = true } = {}) {
    const today = todayISO(); // recomputed on every render — midnight-safe
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

    if (scroll) centerSelected();
  }

  /**
   * Center the currently-selected chip inside the strip WITHOUT touching
   * the page's vertical scroll. Uses scrollLeft math so nothing above or
   * below the strip moves.
   */
  function centerSelected() {
    // Wait two RAFs so layout is fully settled on first paint / route change.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sel = strip.querySelector(".day-chip.is-selected");
        if (!sel) return;
        const target =
          sel.offsetLeft - (strip.clientWidth - sel.clientWidth) / 2;
        const maxLeft = strip.scrollWidth - strip.clientWidth;
        const left = Math.max(0, Math.min(target, maxLeft));
        strip.scrollTo({ left, behavior: "smooth" });
      });
    });
  }

  /* ---------- Interaction --------------------------------------------- */

  function selectDate(iso) {
    if (!iso || iso === selected) return;
    selected = iso;
    render({ scroll: true });
    onChange?.(iso);
  }

  delegate(strip, "click", ".day-chip", (e, chip) => {
    if (chip.classList.contains("is-future")) return;
    selectDate(chip.dataset.iso);
  });

  /* ---------- Swipe gesture ------------------------------------------- */

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

  /* ---------- Midnight watcher ---------------------------------------- */
  /**
   * If the app is left open across midnight, re-render at 00:01 so the
   * "today" chip is correct. We schedule based on the actual time until
   * the next midnight + 1 minute.
   */
  let midnightTimer = null;
  function scheduleMidnightRefresh() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 1, 0, 0); // 00:01 of the next day
    const delay = Math.max(30 * 1000, next - now); // at least 30s
    midnightTimer = setTimeout(() => {
      // Re-render so "today" is correct. Selection is preserved.
      render({ scroll: true });
      scheduleMidnightRefresh();
    }, delay);
  }
  scheduleMidnightRefresh();

  render();

  /* ---------- Public API ---------------------------------------------- */

  return {
    setDate(iso, { silent = true } = {}) {
      if (!iso || iso === selected) return;
      selected = iso;
      render({ scroll: true });
      if (!silent) onChange?.(iso);
    },

    /**
     * Jump the strip back to today — both visually (center the chip) and
     * as the selected date. Emits `onChange` so subscribers (state, pages)
     * stay in sync.
     */
    scrollToToday({ silent = false } = {}) {
      const today = todayISO();
      const changed = selected !== today;
      selected = today;
      render({ scroll: true });
      if (changed && !silent) onChange?.(today);
    },

    refreshData(datesArray) {
      dataSet = new Set(datesArray || []);
      render({ scroll: false });
    },

    get date() { return selected; },

    destroy() {
      if (midnightTimer) clearTimeout(midnightTimer);
      midnightTimer = null;
      container.innerHTML = "";
    },
  };
}