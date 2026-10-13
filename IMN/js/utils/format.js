/**
 * Number / unit formatting helpers, RTL-friendly.
 *
 * Notes on units & digits
 * -----------------------
 * • Digits are rendered as Latin (0-9) everywhere for legibility, but
 *   PERSIAN and ARABIC-INDIC digits are converted on input.
 * • Units are consistent:
 *      kcal  → "kcal"
 *      grams → "گرم"
 *      kg    → "کیلوگرم"
 *      km    → "کیلومتر"
 *      bp    → "mmHg"
 *      glucose → "mg/dL"
 *      insulin → "واحد"
 * • Durations: `formatDuration` (verbose, e.g. "۳ ساعت و ۲۵ دقیقه")
 *   and `formatHoursBrief` (compact, e.g. "8س 12د"). Both are provided
 *   on purpose; pick by available space.
 */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toPersianDigits(input) {
  if (input == null) return "";
  return String(input).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

export function toLatinDigits(input) {
  if (input == null) return "";
  return String(input)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/**
 * Normalize a user-entered number string:
 *   • Persian/Arabic digits → Latin
 *   • Persian decimal separator (٫) → "."
 *   • Thousands separators ("," and "٬") removed
 *   • anything else non-numeric stripped (keeps leading "-")
 * Returns "" for empty/whitespace-only input.
 */
export function normalizeNumber(input) {
  if (input == null || input === "") return "";
  let s = toLatinDigits(String(input));
  s = s.replace(/٫/g, ".").replace(/٬/g, "").replace(/,/g, "");
  s = s.replace(/[^\d.\-]/g, "");
  return s;
}

/* ---------- Numbers --------------------------------------------------- */

export function formatNumber(n, { decimals = 0, fallback = "—" } = {}) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return fallback;
  const value = Number(n);
  if (!Number.isFinite(value)) return fallback;
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

export function formatCalories(kcal, { withUnit = true } = {}) {
  const v = formatInteger(kcal);
  return withUnit ? `${v} kcal` : v;
}

export function formatGrams(g, decimals = 1) {
  return `${formatNumber(g, { decimals })} گرم`;
}

export function formatKg(kg, decimals = 2) {
  return `${formatNumber(kg, { decimals })} کیلوگرم`;
}

export function formatKm(km, decimals = 2) {
  return `${formatNumber(km, { decimals })} کیلومتر`;
}

export function formatGlucose(mg) {
  return `${formatInteger(mg)} mg/dL`;
}

export function formatBP(sys, dia) {
  if (sys == null || dia == null) return "—";
  return `${formatInteger(sys)}/${formatInteger(dia)} mmHg`;
}

export function formatInsulin(units, decimals = 1) {
  return `${formatNumber(units, { decimals })} واحد`;
}

export function formatPercent(n, decimals = 0) {
  return `${formatNumber(n, { decimals })}٪`;
}

/* ---------- Durations ------------------------------------------------- */

/** Verbose: "3 ساعت و 25 دقیقه". */
export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} ساعت و ${m} دقیقه`;
  if (h) return `${h} ساعت`;
  return `${m} دقیقه`;
}

/**
 * Compact: "8س 12د" / "8س" / "12د".
 * Rounds to the nearest minute so 7.999 h → "8س" (never "7س 60د").
 */
export function formatHoursBrief(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}س ${m}د`;
  if (h) return `${h}س`;
  return `${m}د`;
}

/* Backwards-compatible alias */
export const formatHoursCompact = formatHoursBrief;

/* ---------- Deltas ---------------------------------------------------- */

export function formatDelta(delta, { unit = "", decimals = 0 } = {}) {
  if (delta == null || Number.isNaN(delta)) return { text: "—", direction: "flat" };
  const v = Number(delta);
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "—";
  const abs = formatNumber(Math.abs(v), { decimals });
  return { text: `${arrow} ${abs}${unit ? " " + unit : ""}`, direction: dir };
}

/* ---------- Escape ---------------------------------------------------- */
/**
 * Escape a string for safe insertion into innerHTML. Prefer this over
 * `sanitizeText` — escaping preserves user-visible content ("a<b" stays
 * "a<b") while neutralizing dangerous markup.
 */
export function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}