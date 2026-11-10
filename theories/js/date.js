const FA_LOCALE = "fa-IR-u-ca-persian";

const SHAMSI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const FA_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shamsiParts(value, options = {}) {
  const date = toDate(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat(FA_LOCALE, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    ...options,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    monthName: SHAMSI_MONTHS[Math.max(0, Number(get("month")) - 1)] || "",
    weekday: FA_WEEKDAYS[date.getDay()] || "",
    raw: date,
  };
}

export function formatShamsi(value, style = "long") {
  const date = toDate(value);
  if (!date) return "—";

  if (style === "short") {
    return new Intl.DateTimeFormat(FA_LOCALE, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  if (style === "numeric") {
    return new Intl.DateTimeFormat(FA_LOCALE, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(date);
  }

  if (style === "month") {
    const parts = shamsiParts(date);
    return `${parts.monthName} ${parts.year}`;
  }

  if (style === "weekday") {
    return new Intl.DateTimeFormat(FA_LOCALE, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(FA_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatShamsiTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShamsiDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return `${formatShamsi(date)}، ساعت ${formatShamsiTime(date)}`;
}

export function relativeFa(value) {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });

  if (abs < 60) return rtf.format(Math.round(seconds), "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), "day");
  if (abs < 2592000) return rtf.format(Math.round(seconds / 604800), "week");
  if (abs < 31536000) return rtf.format(Math.round(seconds / 2592000), "month");
  return rtf.format(Math.round(seconds / 31536000), "year");
}

export function shamsiYear(value) {
  return shamsiParts(value)?.year || "";
}

export function shamsiMonthName(value) {
  return shamsiParts(value)?.monthName || "";
}

export function currentShamsiYear() {
  return shamsiParts(new Date())?.year || "";
}

export function isSameShamsiDay(a, b) {
  const pa = shamsiParts(a);
  const pb = shamsiParts(b);
  if (!pa || !pb) return false;
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function daysAgoLabel(value) {
  const date = toDate(value);
  if (!date) return "—";
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff <= 0) return "امروز";
  if (diff === 1) return "دیروز";
  if (diff < 7) return `${diff} روز پیش`;
  if (diff < 30) return `${Math.floor(diff / 7)} هفته پیش`;
  if (diff < 365) return `${Math.floor(diff / 30)} ماه پیش`;
  return `${Math.floor(diff / 365)} سال پیش`;
}

export { SHAMSI_MONTHS, FA_WEEKDAYS };
