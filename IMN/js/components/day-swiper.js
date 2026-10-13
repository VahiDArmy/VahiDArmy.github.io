/**
 * Day Swiper — horizontal strip of day chips under the topbar.
 *
 * Centering logic
 * ---------------
 * The strip lives in an RTL document. Modern browsers (Chrome 85+,
 * Firefox 68+, Safari 14+) use the spec-compliant RTL `scrollLeft`
 * convention: 0 is the RIGHT edge (the START), and increasing values
 * scroll toward the LEFT edge.
 *
 * We do NOT compute scrollLeft ourselves. Instead we measure the chip
 * and the strip with `getBoundingClientRect()` and compute the visual
 * delta, then flip the sign for RTL. This works regardless of the
 * scrollLeft convention, CSS padding, or the strip's inner direction.
 *
 * Three stacked `requestAnimationFrame`s make sure the DOM has laid out
 * fully before we measure — the chips have real dimensions at that
 * point.
 *
 * Auto-centering is triggered:
 *   • on mount
 *   • whenever the selected date changes (setDate)
 *   • on `scrollToToday()` / `date:today`
 *   • on route changes back to a swiper-enabled page
 *   • on a 30-second interval as a safety net while the swiper is visible
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

  let selected = initialDate || todayISO();
  let dataSet = new Set();
  let visible = true;

  container.innerHTML = `<div class="day-swiper" role="tablist" aria-label="انتخاب روز"></div>`;
  const strip = container.querySelector(".day-swiper");

  /* ---------- Rendering ------------------------------------------------ */

  function render({ scroll = true } = {}) {
    const today = todayISO();
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
   * Center the currently-selected chip in the strip's viewport.
   * Direction-aware, uses viewport-relative measurement only.
   */
  function centerSelected() {
    // Triple rAF — first paints innerHTML, second settles fonts, third
    // settles scroll snapping. Measurements are safe at this point.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!visible) return;
          const sel = strip.querySelector(".day-chip.is-selected");
          if (!sel) return;

          const stripRect = strip.getBoundingClientRect();
          const selRect = sel.getBoundingClientRect();

          // If the strip itself has no size (hidden route), skip.
          if (stripRect.width === 0) return;

          // Positive = chip is currently to the RIGHT of the strip's center
          const stripCenter = stripRect.left + stripRect.width / 2;
          const chipCenter = selRect.left + selRect.width / 2;
          const offset = chipCenter - stripCenter;

          // Close enough — avoid jittery micro-scrolls.
          if (Math.abs(offset) < 4) return;

          const isRTL = getComputedStyle(strip).direction === "rtl";
          // LTR: +offset → scroll right (increase scrollLeft)
          // RTL: +offset → chip is closer to the START (right); scroll
          //                back toward 0 (decrease scrollLeft)
          const delta = isRTL ? -offset : offset;

          const maxLeft = strip.scrollWidth - strip.clientWidth;
          const target = strip.scrollLeft + delta;
          const clamped = Math.max(0, Math.min(target, maxLeft));

          try {
            strip.scrollTo({ left: clamped, behavior: "smooth" });
          } catch {
            // Older Safari ignores options object
            strip.scrollLeft = clamped;
          }
        });
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

  /* ---------- Visibility observer ------------------------------------- */
  /**
   * When the strip is hidden (e.g. on /settings) we don't want to waste
   * rAFs on centering. When it becomes visible again, we re-center.
   */
  const io = new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting || entry.intersectionRatio > 0;
    if (!wasVisible && visible) centerSelected();
  }, { threshold: 0 });
  io.observe(strip);

  /* ---------- Midnight + safety interval ------------------------------ */

  let midnightTimer = null;
  function scheduleMidnightRefresh() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 1, 0, 0);
    const delay = Math.max(30 * 1000, next - now);
    midnightTimer = setTimeout(() => {
      render({ scroll: true });
      scheduleMidnightRefresh();
    }, delay);
  }
  scheduleMidnightRefresh();

  // Safety net: every 20s, if the strip is visible and the selected chip
  // is off-center by more than a chip-width, re-center. This catches
  // edge cases where a browser resets scrollLeft after a re-render or
  // orientation change.
  const safetyInterval = setInterval(() => {
    if (!visible) return;
    const sel = strip.querySelector(".day-chip.is-selected");
    if (!sel) return;
    const stripRect = strip.getBoundingClientRect();
    const selRect = sel.getBoundingClientRect();
    const offset =
      (selRect.left + selRect.width / 2) -
      (stripRect.left + stripRect.width / 2);
    if (Math.abs(offset) > selRect.width * 1.5) centerSelected();
  }, 20000);

  // Re-center on window resize / orientation change
  window.addEventListener("resize", centerSelected);

  render();

  /* ---------- Public API ---------------------------------------------- */

  return {
    setDate(iso, { silent = true } = {}) {
      if (!iso) return;
      if (iso === selected) {
        // Same date — but strip may have been scrolled away; re-center.
        centerSelected();
        return;
      }
      selected = iso;
      render({ scroll: true });
      if (!silent) onChange?.(iso);
    },

    scrollToToday({ silent = false } = {}) {
      const today = todayISO();
      const changed = selected !== today;
      selected = today;
      render({ scroll: true });
      // Second pass after smooth scroll settles, in case layout shifted
      setTimeout(centerSelected, 300);
      if (changed && !silent) onChange?.(today);
    },

    refreshData(datesArray) {
      dataSet = new Set(datesArray || []);
      render({ scroll: false });
    },

    /** Force a re-center — useful after an explicit route change. */
    recenter: centerSelected,

    get date() { return selected; },

    destroy() {
      if (midnightTimer) clearTimeout(midnightTimer);
      clearInterval(safetyInterval);
      io.disconnect();
      window.removeEventListener("resize", centerSelected);
      container.innerHTML = "";
    },
  };
}