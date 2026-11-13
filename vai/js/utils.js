// ============================================================================
// utils.js — tiny helpers shared everywhere (no imports)
// ============================================================================

const HTML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESC[c]);
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, "&#96;");
}

/** Very small debounce. */
export function debounce(fn, ms = 250) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Throttle. */
export function throttle(fn, ms = 100) {
  let last = 0, timer;
  return function (...args) {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/** uuid v4 via crypto. */
export function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Format a JS Date as Persian-ish timestamp. */
export function formatTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function formatDate(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatRelative(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return "همین حالا";
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} روز پیش`;
  return formatDate(d);
}

/** en digits → Persian digits. */
export function fa(n) {
  if (n == null || n === "") return "";
  const s = String(n);
  const map = "۰۱۲۳۴۵۶۷۸۹";
  return s.replace(/[0-9]/g, (d) => map[+d]);
}

export function faInt(n) {
  if (n == null || isNaN(n)) return "۰";
  return fa(Math.round(n));
}

/** Human tokens: 1_234 → "۱٬۲۳۴". 1_234_567 → "۱.۲M". */
export function fmtTokens(n) {
  if (n == null || isNaN(n)) return "۰";
  n = Number(n);
  if (n < 1000) return fa(Math.round(n));
  if (n < 1_000_000) {
    const v = n / 1000;
    return fa(v.toFixed(v < 10 ? 1 : 0)) + "K";
  }
  const v = n / 1_000_000;
  return fa(v.toFixed(v < 10 ? 1 : 0)) + "M";
}

export function fmtBytes(b) {
  if (b == null || isNaN(b)) return "۰";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = Number(b);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${fa(v.toFixed(v < 10 ? 1 : 0))} ${units[i]}`;
}

/** Approx. tokenizer: ~1 token per 4 latin chars, ~1 per 2 CJK/arabic chars. */
export function estimateTokens(text) {
  if (!text) return 0;
  let tokens = 0;
  // Iterate codepoints
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c <= 127) {
      tokens += 1 / 4; // latin-ish
    } else if (c >= 0x0600 && c <= 0x06ff) {
      tokens += 1 / 1.8; // arabic/persian
    } else if (
      (c >= 0x3040 && c <= 0x30ff) ||
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0xac00 && c <= 0xd7af)
    ) {
      tokens += 1 / 1.5; // CJK
    } else if (c < 0x10000) {
      tokens += 1 / 2;
    } else {
      tokens += 1 / 1.5;
    }
  }
  return Math.ceil(tokens);
}

/** bytes of a UTF-8 string. */
export function byteLength(str) {
  if (!str) return 0;
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str).length;
  }
  return unescape(encodeURIComponent(str)).length;
}

/** Copy helper (returns true if success). */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "dataset") Object.assign(e.dataset, v);
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

/** Scroll a container to the bottom if we're already close to it. */
export function autoScroll(container, { threshold = 90, smooth = true } = {}) {
  if (!container) return false;
  const gap = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (gap <= threshold) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    return true;
  }
  return false;
}

export function isNearBottom(container, threshold = 120) {
  if (!container) return true;
  return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
}

/** Safe JSON parse. */
export function tryJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Deep clone for JSON-able values. */
export function clone(v) {
  try {
    return structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
}

/** Truncate long ids for display. */
export function shortId(id, n = 8) {
  if (!id) return "";
  return id.length > n ? `${id.slice(0, n)}…` : id;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** A very simple event bus. */
export class Emitter {
  constructor() {
    this.map = new Map();
  }
  on(ev, cb) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev).add(cb);
    return () => this.off(ev, cb);
  }
  off(ev, cb) {
    const set = this.map.get(ev);
    if (!set) return;
    set.delete(cb);
    if (!set.size) this.map.delete(ev);
  }
  emit(ev, ...args) {
    const set = this.map.get(ev);
    if (!set) return;
    for (const cb of [...set]) {
      try {
        cb(...args);
      } catch (e) {
        console.error("[emitter]", ev, e);
      }
    }
  }
}

export const emitter = new Emitter();

/** Converts "openai/gpt-4o-mini" → "OpenAI · GPT-4o mini" for display. */
export function prettifyModelId(id) {
  if (!id) return "";
  if (id === "openrouter/free") return "Auto · Free";
  const [provider, name = id] = id.split("/");
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return `${cap(provider)} · ${name}`;
}
