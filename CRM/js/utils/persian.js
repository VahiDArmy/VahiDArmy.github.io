/* ============================================================================
   PERSIAN LANGUAGE UTILITIES
   ============================================================================ */

(function (window) {
  "use strict";

  const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  const Persian = {
    /* ---------- Digits ---------- */
    toPersianDigits(value) {
      if (value == null) return "";
      return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[+d]);
    },

    toEnglishDigits(value) {
      if (value == null) return "";
      return String(value)
        .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
    },

    hasPersianDigits(value) {
      return /[۰-۹]/.test(String(value || ""));
    },

    /* ---------- Cleanup ---------- */
    normalize(value) {
      if (value == null) return "";
      return this.toEnglishDigits(String(value))
        .replace(/\u200C/g, " ") // ZWNJ
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/ة/g, "ه")
        .replace(/\u064B-\u0652/g, "") // diacritics
        .replace(/\s+/g, " ")
        .trim();
    },

    /* ---------- Comparison / search ---------- */
    matches(haystack, needle) {
      if (!haystack || !needle) return false;
      const h = this.normalize(haystack).toLowerCase();
      const n = this.normalize(needle).toLowerCase();
      return h.includes(n);
    },

    /* ---------- Numbers in words ---------- */
    numberToWords(num) {
      const n = Number(this.toEnglishDigits(num));
      if (isNaN(n) || n === 0) return "صفر";
      if (n < 0) return `منفی ${this.numberToWords(Math.abs(n))}`;
      if (n > 999999999999) return String(n);

      const yekan = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
      const dahgan = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
      const dah = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
      const sadgan = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "شصد", "هفتصد", "هشتصد", "نهصد"];
      const scales = ["", " هزار", " میلیون", " میلیارد", " بیلیون"];

      const chunk = (n) => {
        const parts = [];
        const s = Math.floor(n / 100);
        const b = n % 100;
        if (s > 0) parts.push(sadgan[s]);
        if (b >= 10 && b < 20) parts.push(dah[b - 10]);
        else {
          const d1 = Math.floor(b / 10);
          const d0 = b % 10;
          if (d1 > 0) parts.push(dahgan[d1]);
          if (d0 > 0) parts.push(yekan[d0]);
        }
        return parts.join(" و ");
      };

      const groups = [];
      let rest = n;
      let i = 0;
      while (rest > 0) {
        const g = rest % 1000;
        if (g > 0) groups.unshift(chunk(g) + scales[i]);
        rest = Math.floor(rest / 1000);
        i++;
      }
      return groups.join(" و ");
    },

    /* ---------- Currency in words ---------- */
    moneyToWords(value) {
      const env = window.ENV || {};
      const symbol = (env.CURRENCY && env.CURRENCY.symbol) || "ریال";
      const num = Number(this.toEnglishDigits(value));
      if (isNaN(num)) return "—";
      return `${this.numberToWords(num)} ${symbol}`;
    },

    /* ---------- Pluralish ---------- */
    plural(count, singular, plural) {
      const n = Number(this.toEnglishDigits(count)) || 0;
      const word = n === 1 ? singular : (plural || singular);
      return `${this.toPersianDigits(n)} ${word}`;
    },

    /* ---------- Sorting alphabetically (Persian) ---------- */
    compare(a, b) {
      return String(a || "").localeCompare(String(b || ""), "fa-IR", {
        sensitivity: "base",
      });
    },

    /* ---------- Slug ---------- */
    slug(str) {
      if (!str) return "";
      return this.normalize(str)
        .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    },

    /* ---------- Truncate ---------- */
    truncate(str, max = 40, suffix = "…") {
      if (str == null) return "";
      const s = String(str);
      if (s.length <= max) return s;
      return s.slice(0, max).trimEnd() + suffix;
    },

    /* ---------- Title-case (Persian) ---------- */
    titleCase(str) {
      if (!str) return "";
      return String(str)
        .split(/\s+/)
        .map((w) => (w ? w[0] + w.slice(1) : ""))
        .join(" ");
    },

    /* ---------- Time ago (short) ---------- */
    timeAgoShort(date) {
      if (!date) return "—";
      const now = Date.now();
      const t = new Date(date).getTime();
      const diff = Math.max(0, now - t);
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return `${this.toPersianDigits(sec)} ثانیه پیش`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${this.toPersianDigits(min)} دقیقه پیش`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${this.toPersianDigits(hr)} ساعت پیش`;
      const day = Math.floor(hr / 24);
      if (day < 30) return `${this.toPersianDigits(day)} روز پیش`;
      const mon = Math.floor(day / 30);
      if (mon < 12) return `${this.toPersianDigits(mon)} ماه پیش`;
      const yr = Math.floor(mon / 12);
      return `${this.toPersianDigits(yr)} سال پیش`;
    },

    /* ---------- Status labels lookup ---------- */
    label(map, key, fallback = "—") {
      if (!map) return fallback;
      return map[key] || fallback;
    },
  };

  window.Persian = Persian;
})(window);