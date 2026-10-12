/* ============================================================================
   PERSIAN DATE PICKER
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Persian = window.Persian;
  const DateUtils = window.DateUtils;

  const DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
                  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

  /* --- Gregorian <-> Jalali conversions --- */
  function toJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
               Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    let jy = -1595 + 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
  }

  function toGregorian(jy, jm, jd) {
    let jy2 = jy + 1595;
    let days = -355668 + 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + jd +
               (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let gd = days + 1;
    const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
                   31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return [gy, gm, gd];
  }

  const DatePicker = {
    create(container, options = {}) {
      if (!container) return null;

      const {
        value = null,
        placeholder = "انتخاب تاریخ",
        onChange = null,
        clearable = true,
        format = "YYYY/MM/DD",
      } = options;

      Dom.empty(container);

      const state = {
        open: false,
        viewYear: 0,
        viewMonth: 0,
        selected: value ? new Date(value) : null,
        displayMonth: 0,
      };

      if (state.selected) {
        const j = toJalali(state.selected.getFullYear(), state.selected.getMonth() + 1, state.selected.getDate());
        state.viewYear = j[0];
        state.viewMonth = j[1];
      } else {
        const now = new Date();
        const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        state.viewYear = j[0];
        state.viewMonth = j[1];
      }

      const wrap = Dom.el("div", { class: "dp" });

      const input = Dom.el("div", { class: "dp__input", tabindex: "0" });
      const icon = Dom.el("i", { class: "ri-calendar-line" });
      const text = Dom.el("span", { class: "dp__input-text is-placeholder" }, placeholder);
      input.appendChild(icon);
      input.appendChild(text);

      let clearBtn = null;
      if (clearable) {
        clearBtn = Dom.el("button", { class: "dp__clear", type: "button", title: "پاک کردن" }, [
          Dom.el("i", { class: "ri-close-line" }),
        ]);
        clearBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          state.selected = null;
          updateDisplay();
          close();
          if (onChange) onChange(null);
        });
        input.appendChild(clearBtn);
      }
      wrap.appendChild(input);

      const panel = Dom.el("div", { class: "dp__panel", hidden: "" });
      wrap.appendChild(panel);

      function updateDisplay() {
        if (state.selected) {
          const j = toJalali(state.selected.getFullYear(), state.selected.getMonth() + 1, state.selected.getDate());
          text.textContent = `${Persian.toPersianDigits(j[0])}/${Persian.toPersianDigits(String(j[1]).padStart(2, "0"))}/${Persian.toPersianDigits(String(j[2]).padStart(2, "0"))}`;
          Dom.removeClass(text, "is-placeholder");
        } else {
          text.textContent = placeholder;
          Dom.addClass(text, "is-placeholder");
        }
      }

      function daysInJalaliMonth(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        // Esfand
        const leap = ((jy - 979) % 33) % 4 === 1;
        return leap ? 30 : 29;
      }

      function render() {
        Dom.empty(panel);
        const header = Dom.el("div", { class: "dp__header" });
        const prev = Dom.el("button", { class: "dp__nav", type: "button" }, [
          Dom.el("i", { class: "ri-arrow-right-s-line" }),
        ]);
        prev.addEventListener("click", () => {
          state.viewMonth--;
          if (state.viewMonth < 1) { state.viewMonth = 12; state.viewYear--; }
          render();
        });

        const next = Dom.el("button", { class: "dp__nav", type: "button" }, [
          Dom.el("i", { class: "ri-arrow-left-s-line" }),
        ]);
        next.addEventListener("click", () => {
          state.viewMonth++;
          if (state.viewMonth > 12) { state.viewMonth = 1; state.viewYear++; }
          render();
        });

        const title = Dom.el("div", { class: "dp__title" },
          `${MONTHS[state.viewMonth - 1]} ${Persian.toPersianDigits(state.viewYear)}`);
        header.appendChild(prev);
        header.appendChild(title);
        header.appendChild(next);
        panel.appendChild(header);

        const weekdays = Dom.el("div", { class: "dp__weekdays" });
        DAYS.forEach((d) => weekdays.appendChild(Dom.el("span", { class: "dp__weekday" }, d)));
        panel.appendChild(weekdays);

        const grid = Dom.el("div", { class: "dp__days" });

        // First day of month (0=Sat)
        const [gy, gm, gd] = toGregorian(state.viewYear, state.viewMonth, 1);
        const firstDate = new Date(gy, gm - 1, gd);
        // JS day: 0=Sun..6=Sat. Convert to Persian: Sat=0, Sun=1,...
        const jsDay = firstDate.getDay();
        const persianOffset = (jsDay + 1) % 7;

        // Previous month tail
        const prevMonth = state.viewMonth === 1 ? 12 : state.viewMonth - 1;
        const prevYear = state.viewMonth === 1 ? state.viewYear - 1 : state.viewYear;
        const daysInPrev = daysInJalaliMonth(prevYear, prevMonth);
        for (let i = persianOffset - 1; i >= 0; i--) {
          const day = daysInPrev - i;
          const cell = Dom.el("button", {
            class: "dp__day is-other-month", type: "button",
          }, Persian.toPersianDigits(day));
          cell.dataset.other = "prev";
          grid.appendChild(cell);
        }

        const totalDays = daysInJalaliMonth(state.viewYear, state.viewMonth);
        const today = new Date();
        const todayJ = toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());

        for (let d = 1; d <= totalDays; d++) {
          const cls = ["dp__day"];
          if (todayJ[0] === state.viewYear && todayJ[1] === state.viewMonth && todayJ[2] === d) {
            cls.push("is-today");
          }
          if (state.selected) {
            const sj = toJalali(state.selected.getFullYear(), state.selected.getMonth() + 1, state.selected.getDate());
            if (sj[0] === state.viewYear && sj[1] === state.viewMonth && sj[2] === d) {
              cls.push("is-selected");
            }
          }
          const cell = Dom.el("button", {
            class: cls.join(" "), type: "button",
          }, Persian.toPersianDigits(d));
          cell.addEventListener("click", () => {
            const [gy2, gm2, gd2] = toGregorian(state.viewYear, state.viewMonth, d);
            state.selected = new Date(gy2, gm2 - 1, gd2);
            updateDisplay();
            close();
            if (onChange) onChange(state.selected);
          });
          grid.appendChild(cell);
        }

        // Next month head to fill grid to multiple of 7
        const cellsSoFar = grid.children.length;
        const remaining = (7 - (cellsSoFar % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
          const cell = Dom.el("button", { class: "dp__day is-other-month", type: "button" }, Persian.toPersianDigits(i));
          grid.appendChild(cell);
        }

        panel.appendChild(grid);

        // Footer
        const footer = Dom.el("div", { class: "dp__footer" });
        const todayBtn = Dom.el("button", { class: "dp__shortcut", type: "button" }, "امروز");
        todayBtn.addEventListener("click", () => {
          const now = new Date();
          state.selected = now;
          const j = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
          state.viewYear = j[0]; state.viewMonth = j[1];
          updateDisplay();
          close();
          if (onChange) onChange(state.selected);
        });
        footer.appendChild(todayBtn);
        panel.appendChild(footer);
      }

      function open() {
        if (state.open) return;
        state.open = true;
        Dom.addClass(wrap, "is-open");
        panel.hidden = false;
        render();
        setTimeout(() => document.addEventListener("click", outside), 0);
      }

      function close() {
        state.open = false;
        Dom.removeClass(wrap, "is-open");
        panel.hidden = true;
        document.removeEventListener("click", outside);
      }

      function outside(e) {
        if (!wrap.contains(e.target)) close();
      }

      input.addEventListener("click", () => state.open ? close() : open());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        else if (e.key === "Escape") close();
      });

      updateDisplay();
      container.appendChild(wrap);

      return {
        el: wrap,
        getValue: () => state.selected,
        setValue(d) {
          state.selected = d ? new Date(d) : null;
          updateDisplay();
        },
        destroy: close,
      };
    },
  };

  window.DatePicker = DatePicker;
})(window);