/**
 * core.js — ابزارهای مشترک
 * اعداد فارسی، تاریخ شمسی (تقویم فارسی Intl)، ذخیره‌سازی، توست و کمک‌تابع‌ها
 */

export const SURAH = 56;
export const AYAH_COUNT = 96;

/* ---------- اعداد و متن ---------- */
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** تبدیل ارقام لاتین به فارسی */
export function fa(value) {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** خواندن عدد فارسی از ورودی کاربر */
export function parseFa(value) {
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[^\d]/g, "");
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function icon(name, cls = "ico") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function debounce(fn, ms = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function throttle(fn, ms = 120) {
  let last = 0;
  let queued = null;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    } else if (!queued) {
      queued = setTimeout(() => {
        queued = null;
        last = Date.now();
        fn(...args);
      }, ms - (now - last));
    }
  };
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* ---------- تاریخ شمسی ---------- */
const TZ = "Asia/Tehran";
let fmtFull, fmtDay, fmtTime, fmtKey, fmtWeekday;

function getFormatters() {
  if (fmtFull) return;
  const opts = { timeZone: TZ, calendar: "persian", numberingSystem: "arabext" };
  fmtFull = new Intl.DateTimeFormat("fa-IR", { ...opts, dateStyle: "long" });
  fmtWeekday = new Intl.DateTimeFormat("fa-IR", { ...opts, weekday: "long" });
  fmtDay = new Intl.DateTimeFormat("fa-IR", { ...opts, day: "numeric", month: "long", year: "numeric" });
  fmtTime = new Intl.DateTimeFormat("fa-IR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    numberingSystem: "arabext",
  });
  fmtKey = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    calendar: "persian",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * اطلاعات شمسی یک تاریخ
 * @param {string|number|Date} input
 * @returns {{dayKey:string, day:string, weekday:string, time:string, full:string, date:Date}}
 */
export function shamsi(input) {
  getFormatters();
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return { dayKey: "?", day: "—", weekday: "", time: "—", full: "—", date: null };
  }
  const parts = fmtKey.formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    dayKey: `${pick("year")}-${pick("month")}-${pick("day")}`,
    day: fmtDay.format(date),
    weekday: fmtWeekday.format(date),
    time: fmtTime.format(date),
    full: fmtFull.format(date),
    date,
  };
}

/** فاصلهٔ نسبی («۳ روز پیش») */
export function relativeFromNow(input) {
  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "همین حالا";
  if (diff < 3_600_000) return `${fa(Math.floor(diff / 60_000))} دقیقه پیش`;
  if (diff < day) return `${fa(Math.floor(diff / 3_600_000))} ساعت پیش`;
  if (diff < day * 30) return `${fa(Math.floor(diff / day))} روز پیش`;
  return shamsi(date).day;
}

export function nowTehranParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return { hour: Number(get("hour")), minute: Number(get("minute")) };
}

/* ---------- ذخیره‌سازی محلی ---------- */
const KEY = "vaqia56:";
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(KEY + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(KEY + key, JSON.stringify(value));
    } catch {
      /* حافظه پر است یا حالت خصوصی */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(KEY + key);
    } catch {
      /* بی‌صدا */
    }
  },
};

/* ---------- توست ---------- */
let toastHost;
export function toast(message, kind = "info", timeout = 3200) {
  toastHost ??= document.getElementById("toasts");
  if (!toastHost) return;
  const node = el(
    "div",
    { class: `toast toast--${kind}` },
    icon(kind === "ok" ? "check" : kind === "warn" ? "spark" : "heart"),
    el("span", {}, message)
  );
  toastHost.append(node);
  setTimeout(() => {
    node.classList.add("is-out");
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  }, timeout);
}

/* ---------- کلیپ‌بورد ---------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/* ---------- اندازهٔ متن ---------- */
export const FONT_STEPS = ["sm", "md", "lg", "xl"];
export const FONT_LABELS = { sm: "کوچک", md: "متوسط", lg: "بزرگ", xl: "خیلی بزرگ" };

export function applyFont(step) {
  const safe = FONT_STEPS.includes(step) ? step : "md";
  document.documentElement.dataset.font = safe;
  store.set("font", safe);
  const label = document.getElementById("fontValue");
  if (label) label.textContent = FONT_LABELS[safe];
  return safe;
}

export function stepFont(direction) {
  const current = document.documentElement.dataset.font || "md";
  const index = clamp(FONT_STEPS.indexOf(current) + direction, 0, FONT_STEPS.length - 1);
  return applyFont(FONT_STEPS[index]);
}

/* ---------- پوسته ---------- */
export const THEMES = ["rose", "night"];

export function applyTheme(theme, { persist = true } = {}) {
  const safe = THEMES.includes(theme) ? theme : "rose";
  document.documentElement.dataset.theme = safe;
  if (persist) store.set("theme", safe);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--theme-color").trim());
  return safe;
}

/* ---------- دسترسی‌پذیری ---------- */
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
