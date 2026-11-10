export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "html") node.innerHTML = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function stripHtml(html = "") {
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export function truncate(value = "", length = 150) {
  const text = String(value).trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, "")}…`;
}

export function debounce(fn, wait = 260) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 160) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export function clsx(...values) {
  return values
    .flat()
    .filter(Boolean)
    .join(" ");
}

export function formatNumber(value, options = {}) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "۰";
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 1,
    ...options,
  }).format(number);
}

export function compactNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return formatNumber(number);
  if (number < 1000000) return `${formatNumber(number / 1000, { maximumFractionDigits: 1 })} هزار`;
  return `${formatNumber(number / 1000000, { maximumFractionDigits: 1 })} میلیون`;
}

export function readingTime(html = "") {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 210));
}

export function wordCount(html = "") {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

export function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s\u200c]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `theory-${Date.now().toString(36)}`;
}

export function getInitials(name = "") {
  const clean = String(name).trim();
  if (!clean) return "ن";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] || ""}${parts[1][0] || ""}`;
}

export function colorFromString(value = "") {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 55%)`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = String(text);
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }
}

export function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function sleep(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path: `/${segments.join("/")}`, segments, query };
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function sanitizeHtml(dirty = "") {
  const allowedTags = new Set([
    "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "DEL", "MARK",
    "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI",
    "BLOCKQUOTE", "PRE", "CODE", "A", "IMG", "HR", "FIGURE",
    "FIGCAPTION", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
    "IFRAME", "SPAN", "DIV",
  ]);
  const allowedAttrs = {
    A: ["href", "target", "rel", "title"],
    IMG: ["src", "alt", "title", "width", "height", "loading"],
    IFRAME: ["src", "title", "width", "height", "allowfullscreen", "frameborder"],
    TH: ["colspan", "rowspan"],
    TD: ["colspan", "rowspan"],
    CODE: ["class"],
    SPAN: ["class"],
    DIV: ["class"],
  };

  const doc = new DOMParser().parseFromString(String(dirty), "text/html");

  const walk = (node) => {
    for (const child of Array.from(node.children)) {
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const allowed = allowedAttrs[child.tagName] || [];
        if (!allowed.includes(attr.name)) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") {
        const href = child.getAttribute("href") || "";
        if (/^\s*javascript:/i.test(href)) child.removeAttribute("href");
        child.setAttribute("rel", "noopener noreferrer");
      }
      if (child.tagName === "IMG") {
        const src = child.getAttribute("src") || "";
        if (!/^(https?:|data:image\/)/i.test(src)) child.remove();
      }
      if (child.tagName === "IFRAME") {
        const src = child.getAttribute("src") || "";
        if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be|player\.vimeo\.com)\//i.test(src)) child.remove();
      }
      walk(child);
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

export function safeImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|data:image\/|\/)/i.test(value)) return value;
  return "";
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function passwordScore(password = "") {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

export function isImageFile(file) {
  return Boolean(file && file.type && file.type.startsWith("image/"));
}

export function fileExtension(filename = "") {
  return (filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

export function normalizeTags(tags = []) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags || "").split(/[,،]/);
  return [...new Set(list.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean))].slice(0, 12);
}

export function scrollToTop(behavior = "smooth") {
  window.scrollTo({ top: 0, behavior });
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function avatarFallback(name, color) {
  return { initials: getInitials(name), background: color || colorFromString(name || "?") };
}

export function debounceAsync(fn, wait = 300) {
  let timer;
  let lastPromise;
  return (...args) => {
    clearTimeout(timer);
    lastPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fn(...args)), wait);
    });
    return lastPromise;
  };
}
