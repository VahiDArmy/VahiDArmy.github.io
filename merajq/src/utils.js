/** Small, dependency-free helpers shared across the app. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

export function truncate(text, length = 80) {
  const s = String(text ?? '');
  if (s.length <= length) return s;
  return `${s.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

export function titleFromText(text, length = 64) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^#+\s*/, '')
    .trim();
  if (!clean) return 'New conversation';
  return truncate(clean, length);
}

export function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

export function debounce(fn, wait = 250) {
  let timer = null;
  const wrapped = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => window.clearTimeout(timer);
  wrapped.flush = (...args) => {
    window.clearTimeout(timer);
    fn(...args);
  };
  return wrapped;
}

export function throttle(fn, wait = 200) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  return (...args) => {
    const now = Date.now();
    lastArgs = args;
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = window.setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...lastArgs);
      }, remaining);
    }
  };
}

export function rafThrottle(fn) {
  let frame = null;
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      fn(...lastArgs);
    });
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function copyText(text) {
  const value = String(text ?? '');
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    area.remove();
  }
  return ok;
}

export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function formatNumber(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatCompact(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatTokens(n) {
  const value = Number(n) || 0;
  if (value < 1000) return String(value);
  if (value < 1000000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`;
  return `${(value / 1000000).toFixed(1)}M`;
}

export function formatContext(n) {
  if (n === null || n === undefined) return 'unknown';
  const value = Number(n);
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= 1000000 && value % 100000 === 0) return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

export function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
  const mins = Math.floor(value / 60000);
  const secs = Math.round((value % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
}

export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function relativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d.getTime();
  if (!Number.isFinite(diff)) return '';
  if (diff < 45000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.round(diff / 86400000)}d ago`;
  return formatDate(d);
}

export function dayBucket(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'Older';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startMessage = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startToday - startMessage) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Previous 7 days';
  if (days < 30) return 'Previous 30 days';
  return 'Older';
}

export function initials(name, fallback = 'M') {
  const text = String(name || '').trim();
  if (!text) return fallback;
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function providerFromSlug(slug) {
  if (!slug) return 'OpenRouter';
  if (slug === 'openrouter/free') return 'OpenRouter';
  const first = String(slug).split('/')[0];
  try {
    return first
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return first;
  }
}

export function prettyModelName(slug) {
  if (!slug) return 'Unknown model';
  if (slug === 'openrouter/free') return 'Free Models Router';
  const tail = String(slug).split('/').slice(1).join('/') || slug;
  return tail
    .replace(/:free$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function modelHue(slug) {
  let hash = 0;
  const text = String(slug || 'model');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  return hash;
}

export function modelBadges(model) {
  const badges = [];
  const input = model?.architecture?.input_modalities || [];
  const params = Array.isArray(model?.supported_parameters) ? model.supported_parameters : [];
  if (input.includes('image')) badges.push({ key: 'vision', label: 'Vision' });
  if (params.includes('reasoning') || params.includes('include_reasoning')) badges.push({ key: 'reasoning', label: 'Reasoning' });
  if (params.includes('tools')) badges.push({ key: 'tools', label: 'Tools' });
  if ((model?.context_length || 0) >= 200000) badges.push({ key: 'long', label: 'Long context' });
  if (model?.slug === 'openrouter/free') badges.push({ key: 'router', label: 'Auto-router' });
  return badges;
}

export function toIso(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function byteLength(text) {
  return new Blob([String(text ?? '')]).size;
}

export async function sha256(text) {
  const value = String(text ?? '');
  if (crypto?.subtle) {
    const data = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function autoGrow(textarea, maxHeight = 320) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const next = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${next}px`;
}

export function setCaretToEnd(el) {
  if (!el) return;
  el.focus();
  const length = el.value?.length ?? 0;
  try {
    el.setSelectionRange(length, length);
  } catch {
    /* some input types do not support selection */
  }
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function isMobileViewport() {
  return window.matchMedia('(max-width: 820px)').matches;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToBottom(container, behavior = 'smooth') {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior });
}

export function isNearBottom(container, threshold = 140) {
  if (!container) return true;
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

export function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
}

export function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function sortBy(list, keyFn, direction = 'asc') {
  return [...list].sort((a, b) => {
    const av = keyFn(a);
    const bv = keyFn(b);
    if (av === bv) return 0;
    const factor = direction === 'desc' ? -1 : 1;
    return av > bv ? factor : -factor;
  });
}

export function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function highlightQuery(text, query) {
  const source = String(text ?? '');
  const needle = String(query ?? '').trim();
  if (!needle) return escapeHtml(source);
  const regex = new RegExp(`(${escapeRegExp(needle)})`, 'ig');
  return escapeHtml(source).replace(regex, '<mark class="hit">$1</mark>');
}
