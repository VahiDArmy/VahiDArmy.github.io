/**
 * Day Swiper — horizontal strip of day chips under the topbar.
 *
 * Design choices that make this version reliable
 * ----------------------------------------------
 *   • NO auto-scroll on mount when the whole strip already fits. The
 *     chips are rendered in DOM order and, in RTL, the browser places
 *     the first chip on the right. As long as the container is wider
 *     than the content, everything is visible without scroll math.
 *
 *   • When the content is wider than the container, we center the
 *     selected chip using `getBoundingClientRect()` deltas — no
 *     `offsetLeft`, no `scrollWidth`, no RTL scrollLeft conventions.
 *     The math is simply: "how far is the chip from the visual center
 *     of the strip?" and then scroll in the opposite direction.
 *
 *   • The sign of the scroll correction is flipped for RTL because in
 *     RTL `scrollLeft` increases as you scroll toward the LEFT edge of
 *     the content (the "end" in RTL is on the left).
 *
 *   • Swipe detection uses a short time window so a fast tap is never
 *     mistaken for a swipe.
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

const DAYS_BEFORE = 14;
const DAYS_AFTER = 7;
const SWIPE_THRESHOLD_PX = 60;
const SWIPE_MAX_MS = 400; // if the pointer is held longer, it's a "hold", not a swipe

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

    if (scroll) centerSelected();
  }

  /**
   * Center the selected chip using only visual measurements. No
   * assumptions about RTL scrollLeft semantics — we just look at where
   * the chip currently appears on screen and correct the difference.
   */
  function centerSelected() {
    // Give the browser time to complete layout. Three rAFs are enough
    // on every browser we care about.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!visible) return;
          const sel = strip.querySelector(".day-chip.is-selected");
          if (!sel) return;

          const stripRect = strip.getBoundingClientRect();
          if (stripRect.width === 0) return;

          // If the entire content fits, there's nothing to scroll.
          if (strip.scrollWidth <= strip.clientWidth + 2) return;

          const chipRect = sel.getBoundingClientRect();

          // Visual horizontal distance between chip center and strip center.
          // Positive → chip is currently RIGHT of the strip's center.
          const delta =
            (chipRect.left + chipRect.width / 2) -
            (stripRect.left + stripRect.width / 2);

          if (Math.abs(delta) < 4) return; // already centered

          // Direction-aware correction:
          //   LTR: positive delta → scroll right   → scrollLeft + delta
          //   RTL: positive delta → scroll left    → scrollLeft - delta
          const isRTL = getComputedStyle(strip).direction === "rtl";
          const correction = isRTL ? -delta : delta;

          const target = strip.scrollLeft + correction;
          const max = strip.scrollWidth - strip.clientWidth;
          const clamped = Math.max(0, Math.min(target, max));

          // Use direct assignment (no smooth) for instant, deterministic
          // positioning. Smooth scroll can be interrupted by layout
          // recalcs and leave the strip half-centered.
          strip.scrollLeft = clamped;
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
    if (swipeJustHappened) return; // suppress click right after a swipe
    selectDate(chip.dataset.iso);
  });

  /* ---------- Swipe gesture -------------------------------------------- */
  /* Track both distance and duration to avoid misclassifying taps. */

  let pointerDown = false;
  let startX = 0;
  let startTime = 0;
  let swipeJustHappened = false;

  strip.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    startX = e.clientX;
    startTime = Date.now();
  });

  strip.addEventListener("pointerup", (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = e.clientX - startX;
    const dt = Date.now() - startTime;
    const isFastSwipe = Math.abs(dx) >= SWIPE_THRESHOLD_PX && dt <= SWIPE_MAX_MS;

    if (!isFastSwipe) return;

    // Block the subsequent `click` event that browsers fire after touch.
    swipeJustHappened = true;
    setTimeout(() => (swipeJustHappened = false), 350);

    if (dx > 0) selectDate(addDays(selected, -1)); // swipe right → previous day
    else selectDate(addDays(selected, 1));         // swipe left  → next day
  });

  strip.addEventListener("pointercancel", () => (pointerDown = false));

  /* ---------- Visibility observer -------------------------------------- */

  const io = new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting || entry.intersectionRatio > 0;
    if (!wasVisible && visible) centerSelected();
  }, { threshold: 0 });
  io.observe(strip);

  /* ---------- Midnight watcher ----------------------------------------- */

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

  // Re-center on viewport resize / orientation change.
  window.addEventListener("resize", centerSelected);

  render();

  /* ---------- Public API ----------------------------------------------- */

  return {
    setDate(iso, { silent = true } = {}) {
      if (!iso) return;
      if (iso === selected) {
        // Same date — make sure it's visible.
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
      setTimeout(centerSelected, 250); // second pass after layout settles
      if (changed && !silent) onChange?.(today);
    },

    refreshData(datesArray) {
      dataSet = new Set(datesArray || []);
      render({ scroll: false });
    },

    recenter: centerSelected,

    get date() { return selected; },

    destroy() {
      if (midnightTimer) clearTimeout(midnightTimer);
      io.disconnect();
      window.removeEventListener("resize", centerSelected);
      container.innerHTML = "";
    },
  };
}