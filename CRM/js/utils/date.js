/* ============================================================================
   DATE / TIME UTILITIES (Day.js + Persian calendar)
   ============================================================================ */

(function (window) {
  "use strict";

  /* ---------- Day.js plugins (loaded globally) ---------- */
  if (window.dayjs) {
    if (window.dayjs_plugin_relativeTime) {
      window.dayjs.extend(window.dayjs_plugin_relativeTime);
    }
    if (window.dayjs_plugin_calendar) {
      window.dayjs.extend(window.dayjs_plugin_calendar);
    }
    window.dayjs.locale("fa");
  }

  const PERSIAN_MONTHS = [
    "فروردین", "اردیبهشت", "خرداد",
    "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر",
    "دی", "بهمن", "اسفند",
  ];

  const PERSIAN_WEEKDAYS = [
    "شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه",
    "چهارشنبه", "پنج‌شنبه", "جمعه",
  ];

  const PERSIAN_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

  const DateUtils = {
    MONTHS: PERSIAN_MONTHS,
    WEEKDAYS: PERSIAN_WEEKDAYS,
    WEEKDAYS_SHORT: PERSIAN_WEEKDAYS_SHORT,

    /* ---------- Now ---------- */
    now() {
      return window.dayjs ? window.dayjs() : new Date();
    },

    /* ---------- To Jalali (Persian) ---------- */
    toJalali(date) {
      if (!date) return null;
      try {
        const d = window.dayjs ? window.dayjs(date) : new Date(date);
        const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        return fmt.format(d);
      } catch (_) {
        return String(date);
      }
    },

    /* ---------- Format (Persian digits) ---------- */
    format(date, pattern = "YYYY/MM/DD") {
      if (!date) return "—";
      try {
        const d = window.dayjs ? window.dayjs(date) : new Date(date);
        if (!window.dayjs) return d.toLocaleDateString("fa-IR");
        const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: pattern.includes("HH") ? "2-digit" : undefined,
          minute: pattern.includes("mm") ? "2-digit" : undefined,
        });
        return fmt.format(d);
      } catch (_) {
        return String(date);
      }
    },

    /* ---------- Short format ---------- */
    short(date) {
      return this.format(date, "YYYY/MM/DD");
    },

    long(date) {
      return this.format(date, "YYYY/MM/DD HH:mm");
    },

    time(date) {
      if (!date) return "—";
      try {
        const d = window.dayjs ? window.dayjs(date) : new Date(date);
        return new Intl.DateTimeFormat("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(d);
      } catch (_) {
        return "—";
      }
    },

    /* ---------- Relative ---------- */
    fromNow(date) {
      if (!date) return "—";
      try {
        if (window.dayjs) return window.dayjs(date).fromNow();
      } catch (_) {}
      return this.format(date);
    },

    /* ---------- Calendar display ---------- */
    calendar(date) {
      if (!date) return "—";
      try {
        if (window.dayjs) {
          return window.dayjs(date).calendar(null, {
            sameDay: "[امروز ساعت] HH:mm",
            lastDay: "[دیروز ساعت] HH:mm",
            lastWeek: "dddd [ساعت] HH:mm",
            sameElse: "YYYY/MM/DD",
          });
        }
      } catch (_) {}
      return this.format(date, "YYYY/MM/DD HH:mm");
    },

    /* ---------- Ranges ---------- */
    startOfDay(date) {
      return window.dayjs ? window.dayjs(date).startOf("day").toDate() : new Date(date);
    },

    endOfDay(date) {
      return window.dayjs ? window.dayjs(date).endOf("day").toDate() : new Date(date);
    },

    daysAgo(n) {
      return window.dayjs ? window.dayjs().subtract(n, "day").toDate() : new Date(Date.now() - n * 86400000);
    },

    daysFromNow(n) {
      return window.dayjs ? window.dayjs().add(n, "day").toDate() : new Date(Date.now() + n * 86400000);
    },

    startOfMonth(date) {
      return window.dayjs ? window.dayjs(date).startOf("month").toDate() : new Date(date);
    },

    endOfMonth(date) {
      return window.dayjs ? window.dayjs(date).endOf("month").toDate() : new Date(date);
    },

    /* ---------- Diff ---------- */
    diffDays(a, b) {
      if (!window.dayjs) return Math.round((new Date(a) - new Date(b)) / 86400000);
      return window.dayjs(a).diff(window.dayjs(b), "day");
    },

    diffHours(a, b) {
      if (!window.dayjs) return Math.round((new Date(a) - new Date(b)) / 3600000);
      return window.dayjs(a).diff(window.dayjs(b), "hour");
    },

    /* ---------- ISO ---------- */
    toISO(date) {
      if (!date) return null;
      return window.dayjs ? window.dayjs(date).toISOString() : new Date(date).toISOString();
    },

    fromISO(str) {
      if (!str) return null;
      return window.dayjs ? window.dayjs(str).toDate() : new Date(str);
    },

    /* ---------- Compare ---------- */
    isToday(date) {
      if (!date) return false;
      return window.dayjs ? window.dayjs(date).isSame(window.dayjs(), "day") : false;
    },

    isYesterday(date) {
      if (!date) return false;
      return window.dayjs ? window.dayjs(date).isSame(window.dayjs().subtract(1, "day"), "day") : false;
    },

    isPast(date) {
      if (!date) return false;
      return window.dayjs ? window.dayjs(date).isBefore(window.dayjs()) : new Date(date) < new Date();
    },

    isFuture(date) {
      if (!date) return false;
      return window.dayjs ? window.dayjs(date).isAfter(window.dayjs()) : new Date(date) > new Date();
    },

    /* ---------- Greeting ---------- */
    greeting() {
      const h = new Date().getHours();
      if (h < 5) return "شب بخیر";
      if (h < 12) return "صبح بخیر";
      if (h < 17) return "ظهر بخیر";
      if (h < 20) return "عصر بخیر";
      return "شب بخیر";
    },

    /* ---------- Duration label ---------- */
    duration(ms) {
      if (!ms || ms < 0) return "—";
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 0) return `${d} روز پیش`;
      if (h > 0) return `${h} ساعت پیش`;
      if (m > 0) return `${m} دقیقه پیش`;
      return `${s} ثانیه پیش`;
    },

    /* ---------- Persian digits ---------- */
    toPersianDigits(value) {
      const map = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
      return String(value).replace(/\d/g, (d) => map[+d]);
    },

    toEnglishDigits(value) {
      return String(value)
        .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    },
  };

  window.DateUtils = DateUtils;
})(window);