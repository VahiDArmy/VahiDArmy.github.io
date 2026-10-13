/**
 * Number / unit formatting helpers, RTL-friendly.
 *
 * Persian app → we deliberately keep Latin digits (12, 3.5) because they
 * read better in dashboards, but the API allows switching to Persian digits.
 */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(input) {
  if (input == null) return "";
  return String(input).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

export function toLatinDigits(input) {
  if (input == null) return "";
  return String(input).replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))
  );
}

/** Format a number with thousand separators, e.g. 12,345.6 */
export function formatNumber(n, { decimals = 0, fallback = "—" } = {}) {
  if (n == null || Number.isNaN(Number(n))) return fallback;
  const value = Number(n);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInteger(n, fallback = "—") {
  return formatNumber(n, { decimals: 0, fallback });
}

export function formatDecimal(n, decimals = 1, fallback = "—") {
  return formatNumber(n, { decimals, fallback });
}

/** Calories — always integer, e.g. "2,145 kcal" */
export function formatCalories(kcal, { withUnit = true } = {}) {
  const v = formatInteger(kcal);
  return withUnit ? `${v} kcal` : v;
}

/** Grams */
export function formatGrams(g, decimals = 1) {
  return `${formatNumber(g, { decimals })} گرم`;
}

/** Kilograms */
export function formatKg(kg, decimals = 2) {
  return `${formatNumber(kg, { decimals })} کیلو`;
}

/** Kilometers */
export function formatKm(km, decimals = 2) {
  return `${formatNumber(km, { decimals })} کیلومتر`;
}

/** Blood glucose mg/dL */
export function formatGlucose(mg) {
  return `${formatInteger(mg)} mg/dL`;
}

/** Blood pressure systolic/diastolic */
export function formatBP(sys, dia) {
  if (sys == null || dia == null) return "—";
  return `${formatInteger(sys)}/${formatInteger(dia)} mmHg`;
}

/** Insulin units */
export function formatInsulin(units, decimals = 1) {
  return `${formatNumber(units, { decimals })} واحد`;
}

/** Percentage */
export function formatPercent(n, decimals = 0) {
  return `${formatNumber(n, { decimals })}٪`;
}

/** Duration in minutes → "۳ ساعت و ۲۵ دقیقه" (Latin digits) */
export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} ساعت و ${m} دقیقه`;
  if (h) return `${h} ساعت`;
  return `${m} دقیقه`;
}

/** Hours as decimal → "8h 12m" compact */
export function formatHoursCompact(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";
  const total = Math.max(0, hours);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  if (h && m) return `${h}س ${m}د`;
  if (h) return `${h}س`;
  return `${m}د`;
}

/** Difference with sign + arrow */
export function formatDelta(delta, { unit = "", decimals = 0 } = {}) {
  if (delta == null || Number.isNaN(delta)) return { text: "—", direction: "flat" };
  const v = Number(delta);
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
  const abs = formatNumber(Math.abs(v), { decimals });
  return {
    text: `${arrow} ${abs}${unit ? " " + unit : ""}`,
    direction: dir,
  };
}

/** Escape HTML (used before injecting user text into innerHTML) */
export function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}